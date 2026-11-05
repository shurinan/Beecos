-- E-mails de notificação. O banco põe cada e-mail numa fila (email_outbox) quando algo acontece;
-- a função send-emails (chamada de minuto em minuto pelo pg_cron) monta o e-mail e envia pelo Resend.
-- "ess" = e-mail de conta, serviço, pagamento ou segurança: chega sempre.
-- Os outros respeitam notification_prefs.emails_optional (ligado por padrão; desliga em Avisos).

ALTER TABLE public.notification_prefs ADD COLUMN IF NOT EXISTS emails_optional boolean NOT NULL DEFAULT true;

CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  to_email text NOT NULL,
  kind text NOT NULL,
  essential boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  resend_id text
);
CREATE INDEX email_outbox_pending ON public.email_outbox (created_at) WHERE sent_at IS NULL;
REVOKE ALL ON public.email_outbox FROM anon, authenticated;
GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- Põe um e-mail na fila. Pega o endereço da conta; respeita a escolha de não receber os opcionais.
CREATE OR REPLACE FUNCTION public.queue_email(_user uuid, _kind text, _essential boolean, _payload jsonb, _dedupe text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE addr text; name text;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  SELECT u.email INTO addr FROM auth.users u WHERE u.id = _user;
  IF addr IS NULL OR addr = '' THEN RETURN; END IF;
  IF NOT _essential AND EXISTS (SELECT 1 FROM public.notification_prefs n WHERE n.user_id = _user AND NOT n.emails_optional) THEN
    RETURN;
  END IF;
  SELECT split_part(coalesce(nullif(p.full_name, ''), 'você'), ' ', 1) INTO name FROM public.profiles p WHERE p.id = _user;
  INSERT INTO public.email_outbox (user_id, to_email, kind, essential, payload, dedupe_key)
  VALUES (_user, addr, _kind, _essential, coalesce(_payload, '{}'::jsonb) || jsonb_build_object('nome', coalesce(name, 'você')), _dedupe)
  ON CONFLICT (dedupe_key) DO NOTHING;
EXCEPTION WHEN others THEN
  -- e-mail nunca pode travar a ação principal (cadastro, pagamento, serviço)
  RAISE WARNING 'queue_email %: %', _kind, SQLERRM;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_email(uuid, text, boolean, jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.person_name(_u uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(full_name, ''), 'Alguém') FROM public.profiles WHERE id = _u;
$$;
REVOKE EXECUTE ON FUNCTION public.person_name(uuid) FROM PUBLIC, anon, authenticated;

-- 1) Boas-vindas
CREATE OR REPLACE FUNCTION public.email_on_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.queue_email(NEW.id, 'welcome', true, '{}'::jsonb, 'welcome:' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER email_welcome AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.email_on_profile();

-- 2) Interesse numa publicação (conversa aberta a partir dela): avisa quem publicou
CREATE OR REPLACE FUNCTION public.email_on_conversation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF NEW.post_id IS NULL THEN RETURN NEW; END IF;
  SELECT id, user_id, title, price, kind INTO p FROM public.posts WHERE id = NEW.post_id;
  IF p.user_id IS NULL OR p.user_id = NEW.user_a THEN RETURN NEW; END IF;
  PERFORM public.queue_email(p.user_id, 'interest', false,
    jsonb_build_object('quem', public.person_name(NEW.user_a), 'vaga', p.title, 'valor', p.price, 'tipo', p.kind),
    'interest:' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER email_interest AFTER INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.email_on_conversation();

-- 3) Serviço combinado: escolhido, aceitou, recusou, concluído
CREATE OR REPLACE FUNCTION public.email_on_engagement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE titulo text; valor text; d jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title, price INTO titulo, valor FROM public.posts WHERE id = NEW.post_id;
  d := jsonb_build_object('vaga', coalesce(titulo, 'serviço'), 'valor', valor,
                          'cliente', public.person_name(NEW.client_id), 'prestador', public.person_name(NEW.provider_id));
  IF NEW.status = 'proposed' THEN
    PERFORM public.queue_email(NEW.provider_id, 'chosen', true, d, 'chosen:' || NEW.id || ':' || extract(epoch FROM NEW.updated_at)::bigint);
  ELSIF NEW.status = 'accepted' THEN
    PERFORM public.queue_email(NEW.client_id, 'accepted', true, d, 'accepted:' || NEW.id || ':' || extract(epoch FROM NEW.updated_at)::bigint);
  ELSIF NEW.status = 'cancelled' AND TG_OP = 'UPDATE' AND OLD.status = 'proposed' AND NEW.cancelled_by = NEW.provider_id THEN
    PERFORM public.queue_email(NEW.client_id, 'declined', true, d, 'declined:' || NEW.id || ':' || extract(epoch FROM NEW.updated_at)::bigint);
  ELSIF NEW.status = 'completed' THEN
    PERFORM public.queue_email(NEW.client_id, 'completed', false, d || jsonb_build_object('outro', public.person_name(NEW.provider_id)), 'completed:c:' || NEW.id);
    PERFORM public.queue_email(NEW.provider_id, 'completed', false, d || jsonb_build_object('outro', public.person_name(NEW.client_id)), 'completed:p:' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER email_engagement AFTER INSERT OR UPDATE OF status ON public.engagements FOR EACH ROW EXECUTE FUNCTION public.email_on_engagement();

-- 4) Pagamentos: cobrança gerada, confirmado, atrasado
CREATE OR REPLACE FUNCTION public.email_on_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d jsonb; ate timestamptz; titulo text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT active_until INTO ate FROM public.subscriptions WHERE user_id = NEW.user_id;
  IF NEW.post_id IS NOT NULL THEN SELECT title INTO titulo FROM public.posts WHERE id = NEW.post_id; END IF;
  d := jsonb_build_object('produto', NEW.kind, 'valor', NEW.value, 'link', NEW.invoice_url, 'pagamento', NEW.asaas_payment_id,
                          'ate', to_char(ate AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
                          'pago', to_char(coalesce(NEW.paid_at, now()) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
                          'vaga', titulo);
  IF NEW.status = 'pending' AND TG_OP = 'INSERT' AND NEW.invoice_url IS NOT NULL THEN
    PERFORM public.queue_email(NEW.user_id, 'pay_pending', true, d, 'pay_pending:' || NEW.asaas_payment_id);
  ELSIF NEW.status = 'paid' THEN
    PERFORM public.queue_email(NEW.user_id, 'pay_confirmed', true, d, 'pay_confirmed:' || NEW.asaas_payment_id);
  ELSIF NEW.status = 'overdue' THEN
    PERFORM public.queue_email(NEW.user_id, 'pay_overdue', true, d, 'pay_overdue:' || NEW.asaas_payment_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER email_payment AFTER INSERT OR UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.email_on_payment();

-- 5) Verificação de identidade: aprovada ou recusada
CREATE OR REPLACE FUNCTION public.email_on_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'approved' THEN
    PERFORM public.queue_email(NEW.user_id, 'verif_approved', true, '{}'::jsonb, 'verif:' || NEW.id);
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.queue_email(NEW.user_id, 'verif_rejected', true, jsonb_build_object('motivo', NEW.reason), 'verif:' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER email_verification AFTER UPDATE OF status ON public.identity_verifications FOR EACH ROW EXECUTE FUNCTION public.email_on_verification();

-- 6) Resumos (pg_cron): mensagens não lidas há mais de 1 hora, no máximo 1 por dia
CREATE OR REPLACE FUNCTION public.queue_unread_digests() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT me.uid, count(*)::int AS n,
           jsonb_agg(jsonb_build_object('de', public.person_name(m.sender_id), 'texto', left(coalesce(nullif(m.content, ''), 'Arquivo'), 80))
                     ORDER BY m.created_at DESC) FILTER (WHERE m.created_at IS NOT NULL) AS itens
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    CROSS JOIN LATERAL (SELECT CASE WHEN c.user_a = m.sender_id THEN c.user_b ELSE c.user_a END AS uid) me
    LEFT JOIN public.conversation_reads cr ON cr.conversation_id = c.id AND cr.user_id = me.uid
    WHERE m.kind = 'user' AND m.sender_id <> me.uid
      AND m.created_at < now() - interval '1 hour' AND m.created_at > now() - interval '3 days'
      AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
      AND NOT EXISTS (SELECT 1 FROM public.user_presence up WHERE up.user_id = me.uid AND up.last_seen_at > now() - interval '1 hour')
    GROUP BY me.uid
  LOOP
    PERFORM public.queue_email(r.uid, 'unread_digest', false,
      jsonb_build_object('n', r.n, 'itens', (SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(r.itens) x LIMIT 3) s)),
      'unread:' || r.uid || ':' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'));
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_unread_digests() FROM PUBLIC, anon, authenticated;

-- 7) Resumo diário das vagas novas da profissão (avisos das últimas 24 horas ainda não lidos)
CREATE OR REPLACE FUNCTION public.queue_job_digests() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.user_id, count(*)::int AS total,
           jsonb_agg(jsonb_build_object('titulo', p.title, 'valor', p.price) ORDER BY n.created_at DESC) AS itens
    FROM public.notifications n
    JOIN public.posts p ON p.id = n.post_id AND p.hidden_at IS NULL AND p.closed_at IS NULL
    WHERE n.kind = 'new_job' AND n.read_at IS NULL AND n.created_at > now() - interval '24 hours'
    GROUP BY n.user_id
  LOOP
    PERFORM public.queue_email(r.user_id, 'job_digest', false,
      jsonb_build_object('n', r.total, 'itens', (SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(r.itens) x LIMIT 5) s)),
      'jobs:' || r.user_id || ':' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'));
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_job_digests() FROM PUBLIC, anon, authenticated;

-- 8) Premium que não renova (anual ou mensal cancelado) termina em 7 dias
CREATE OR REPLACE FUNCTION public.queue_premium_ending() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT user_id, active_until, plan_term FROM public.subscriptions
    WHERE plan = 'premium' AND active_until BETWEEN now() + interval '6 days' AND now() + interval '7 days'
      AND (plan_term = 'annual' OR cancel_requested_at IS NOT NULL)
  LOOP
    PERFORM public.queue_email(r.user_id, 'premium_ending', true,
      jsonb_build_object('ate', to_char(r.active_until AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'), 'anual', r.plan_term = 'annual'),
      'ending:' || r.user_id || ':' || to_char(r.active_until, 'YYYY-MM-DD'));
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_premium_ending() FROM PUBLIC, anon, authenticated;

-- 9) A função send-emails pega a fila em lotes
CREATE OR REPLACE FUNCTION public.claim_emails(_limit integer DEFAULT 40)
RETURNS SETOF public.email_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.email_outbox o SET attempts = o.attempts + 1
  WHERE o.id IN (
    SELECT id FROM public.email_outbox
    WHERE sent_at IS NULL AND attempts < 5 AND created_at > now() - interval '3 days'
      -- cobrança gerada só vai se continuar sem pagar depois de 15 minutos (Pix costuma ser pago na hora)
      AND (kind <> 'pay_pending' OR created_at < now() - interval '15 minutes')
    ORDER BY created_at LIMIT greatest(1, least(_limit, 100)) FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_emails(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_emails(integer) TO service_role;

-- 10) Agenda (horário de Brasília = UTC-3)
SELECT cron.schedule('beecos-emails-envio', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://qfheectjquxfgmexahem.supabase.co/functions/v1/send-emails',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 55000)
$$);
SELECT cron.schedule('beecos-emails-nao-lidas', '15 * * * *', $$ SELECT public.queue_unread_digests() $$);
SELECT cron.schedule('beecos-emails-vagas', '30 21 * * *', $$ SELECT public.queue_job_digests() $$);
SELECT cron.schedule('beecos-emails-premium-fim', '0 13 * * *', $$ SELECT public.queue_premium_ending() $$);
