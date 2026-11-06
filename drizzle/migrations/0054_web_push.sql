-- Avisos do sistema (barra de notificações do celular e do computador) mesmo com o app fechado:
-- Web Push. A pessoa autoriza no aparelho; o banco guarda a inscrição e a função send-push envia.

-- Chaves do servidor (VAPID). A função send-push cria na primeira vez; ninguém de fora lê a privada.
CREATE TABLE IF NOT EXISTS public.app_keys (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_keys FROM anon, authenticated;
GRANT ALL ON public.app_keys TO service_role;

-- A chave pública vai para o aparelho na hora de autorizar
CREATE OR REPLACE FUNCTION public.vapid_public_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM public.app_keys WHERE name = 'vapid_public';
$$;
GRANT EXECUTE ON FUNCTION public.vapid_public_key() TO anon, authenticated;

CREATE TABLE public.push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_ok_at timestamptz
);
CREATE INDEX push_subscriptions_user ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/',
  tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX push_outbox_pending ON public.push_outbox (created_at) WHERE sent_at IS NULL;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_outbox FROM anon, authenticated;
GRANT ALL ON public.push_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.claim_pushes(_limit integer DEFAULT 100)
RETURNS SETOF public.push_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.push_outbox o SET attempts = o.attempts + 1
  WHERE o.id IN (
    SELECT id FROM public.push_outbox
    WHERE sent_at IS NULL AND attempts < 3 AND created_at > now() - interval '1 hour'
    ORDER BY created_at LIMIT greatest(1, least(_limit, 200)) FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_pushes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pushes(integer) TO service_role;

-- Entra na fila só para quem tem algum aparelho autorizado, e já chama o envio
CREATE OR REPLACE FUNCTION public.queue_push(_user uuid, _title text, _body text, _url text, _tag text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user IS NULL OR NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = _user) THEN
    RETURN;
  END IF;
  INSERT INTO public.push_outbox (user_id, title, body, url, tag)
  VALUES (_user, left(_title, 120), left(coalesce(_body, ''), 200), coalesce(_url, '/'), _tag);
  PERFORM net.http_post(
    url := 'https://qfheectjquxfgmexahem.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
EXCEPTION WHEN others THEN
  RAISE WARNING 'queue_push: %', SQLERRM; -- aviso nunca trava a mensagem
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_push(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Botão "Testar" das preferências: manda um aviso para os aparelhos da própria pessoa
CREATE OR REPLACE FUNCTION public.send_test_push() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = auth.uid()) THEN RETURN false; END IF;
  PERFORM public.queue_push(auth.uid(), 'Avisos do Beecos ligados ✓', 'É assim que você vai saber de mensagens e vagas novas.', '/avisos', 'teste');
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_test_push() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_test_push() TO authenticated;

-- Mensagem nova no chat
CREATE OR REPLACE FUNCTION public.push_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; dest uuid; who text; slug text;
BEGIN
  IF NEW.kind <> 'user' THEN RETURN NEW; END IF;
  SELECT user_a, user_b INTO c FROM public.conversations WHERE id = NEW.conversation_id;
  dest := CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END;
  SELECT coalesce(nullif(full_name, ''), 'Alguém'), p.slug INTO who, slug FROM public.profiles p WHERE id = NEW.sender_id;
  PERFORM public.queue_push(dest, 'Nova mensagem de ' || coalesce(who, 'Alguém'),
    coalesce(nullif(NEW.content, ''), CASE WHEN NEW.attachment_name IS NOT NULL THEN '📎 ' || NEW.attachment_name ELSE 'Nova mensagem' END),
    '/conversas/' || coalesce(slug, NEW.sender_id::text), '/conversas/' || NEW.conversation_id);
  RETURN NEW;
END $$;
CREATE TRIGGER push_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.push_on_message();

-- Avisos do sino (vaga nova, sua vez na fila, prêmios…)
CREATE OR REPLACE FUNCTION public.push_on_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE url text := '/avisos';
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT '/vagas/' || coalesce(pr.slug, 'outros') || '/' || p.slug INTO url
    FROM public.posts p LEFT JOIN public.professions pr ON pr.id = p.profession_id WHERE p.id = NEW.post_id;
  END IF;
  PERFORM public.queue_push(NEW.user_id, NEW.title, NEW.body, coalesce(url, '/avisos'), 'aviso:' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER push_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();

-- Reserva: se a chamada direta falhar, tenta de novo a cada minuto
SELECT cron.schedule('beecos-push-envio', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://qfheectjquxfgmexahem.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 55000)
  WHERE EXISTS (SELECT 1 FROM public.push_outbox WHERE sent_at IS NULL AND attempts < 3
                AND created_at > now() - interval '1 hour')
$$);
