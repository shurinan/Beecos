-- (1) Selo Urgente: incluído no Premium; para os demais é pago (R$ 2 por vaga) e fica travado até o
--     pagamento avulso existir. Vagas que já estavam marcadas continuam como estão.
-- (2) Guarda do que é apagado: só de quem tem denúncia (feita ou recebida), por 7 dias, para auditoria.
--     Conta excluída sem denúncia é apagada por completo.
-- (3) Anexos do chat (fotos e PDFs) somem depois de 48 horas; o texto das mensagens fica.
-- (4) Denúncia de má-fé: o moderador pode marcar; quem acumula 2 em 90 dias perde o direito de denunciar.
-- Depende de 0028, 0030 e 0034. Os agendamentos (pg_cron) ficam no fim.

-- 1) Urgente ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_post_highlight() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.highlight AND NOT public.is_premium(NEW.user_id) THEN
    NEW.highlight := false;
  END IF;
  IF NEW.urgent AND (TG_OP = 'INSERT' OR NOT OLD.urgent) AND NOT public.is_premium(NEW.user_id) THEN
    NEW.urgent := false; -- pago à parte: liberar aqui quando houver o pagamento avulso
  END IF;
  RETURN NEW;
END $$;

-- 2) Guarda de 7 dias só com denúncia ---------------------------------------------------------------------
-- a denúncia não some quando quem denunciou exclui a conta (fica sem o nome)
ALTER TABLE public.reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.reports DROP CONSTRAINT reports_reporter_id_fkey;
ALTER TABLE public.reports ADD CONSTRAINT reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- quem excluiu a conta tendo denúncia: os dados apagados ficam 7 dias para auditoria
CREATE TABLE public.audit_holds (
  user_id uuid PRIMARY KEY,
  until timestamptz NOT NULL
);
REVOKE ALL ON public.audit_holds FROM anon, authenticated;
GRANT ALL ON public.audit_holds TO service_role;
ALTER TABLE public.audit_holds ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.has_reports(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _u IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.reports WHERE reporter_id = _u OR reported_id = _u)
    OR EXISTS (SELECT 1 FROM public.audit_holds WHERE user_id = _u AND until > now()))
$$;
REVOKE EXECUTE ON FUNCTION public.has_reports(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.archive_deleted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o jsonb := to_jsonb(OLD); who uuid[];
BEGIN
  who := CASE TG_TABLE_NAME
    WHEN 'posts' THEN ARRAY[(o->>'user_id')::uuid]
    WHEN 'messages' THEN ARRAY[(o->>'sender_id')::uuid]
    WHEN 'conversations' THEN ARRAY[(o->>'user_a')::uuid, (o->>'user_b')::uuid]
    WHEN 'reviews' THEN ARRAY[(o->>'reviewer_id')::uuid, (o->>'reviewee_id')::uuid]
    WHEN 'engagements' THEN ARRAY[(o->>'client_id')::uuid, (o->>'provider_id')::uuid]
    WHEN 'profiles' THEN ARRAY[(o->>'id')::uuid]
    ELSE ARRAY[]::uuid[] END;
  IF EXISTS (SELECT 1 FROM unnest(who) u WHERE public.has_reports(u)) THEN
    INSERT INTO public.deleted_records (table_name, record_id, record, deleted_by)
    VALUES (TG_TABLE_NAME, o ->> 'id', o, auth.uid());
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.delete_my_account() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.engagements e
             WHERE (e.client_id = me OR e.provider_id = me) AND e.status IN ('proposed', 'accepted')) THEN
    RAISE EXCEPTION 'CONTA_COM_SERVICO_ATIVO' USING ERRCODE = '55000';
  END IF;
  -- com denúncia: guarda por 7 dias o que for apagado (as denúncias perdem o vínculo com a conta)
  IF EXISTS (SELECT 1 FROM public.reports WHERE reporter_id = me OR reported_id = me) THEN
    INSERT INTO public.audit_holds (user_id, until) VALUES (me, now() + interval '7 days')
    ON CONFLICT (user_id) DO UPDATE SET until = excluded.until;
  END IF;
  DELETE FROM auth.users WHERE id = me;
END $$;

CREATE FUNCTION public.purge_expired_records() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.deleted_records WHERE deleted_at < now() - interval '7 days';
  DELETE FROM public.audit_holds WHERE until < now();
$$;
REVOKE EXECUTE ON FUNCTION public.purge_expired_records() FROM PUBLIC, anon, authenticated;

-- 3) Anexos do chat por 48 horas: a função cleanup-chat-files apaga o arquivo e marca a mensagem
ALTER TABLE public.messages ADD COLUMN attachment_expired_at timestamptz;
CREATE INDEX messages_attachment_expiry ON public.messages (created_at)
  WHERE attachment_path IS NOT NULL AND attachment_expired_at IS NULL;

-- 4) Má-fé ------------------------------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN bad_faith boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.report_content(_type text, _target uuid, _reason text, _details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); label text; owner uuid; rid uuid; u uuid; r text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
  IF (SELECT count(*) FROM public.reports WHERE reporter_id = me AND bad_faith AND reviewed_at > now() - interval '90 days') >= 2 THEN
    RAISE EXCEPTION 'DENUNCIAS_SUSPENSAS' USING ERRCODE = '42501';
  END IF;
  IF _type = 'post' THEN
    SELECT left(title, 120), user_id INTO label, owner FROM public.posts WHERE id = _target AND hidden_at IS NULL;
  ELSIF _type = 'profile' THEN
    SELECT left(coalesce(nullif(slug, ''), full_name, ''), 120), id INTO label, owner FROM public.profiles WHERE id = _target;
  ELSE
    RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF owner IS NULL THEN RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023'; END IF;
  IF owner = me THEN RAISE EXCEPTION 'DENUNCIA_PROPRIA' USING ERRCODE = '22023'; END IF;
  IF _reason NOT IN ('golpe', 'ofensivo', 'falso', 'contato_externo', 'outro') THEN
    RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.reports WHERE reporter_id = me AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'DENUNCIAS_DEMAIS' USING ERRCODE = '54000';
  END IF;
  BEGIN
    INSERT INTO public.reports (reporter_id, reported_id, target_type, target_id, target_label, reason, details)
    VALUES (me, owner, _type, _target, coalesce(label, ''), _reason, left(coalesce(_details, ''), 500))
    RETURNING id INTO rid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'DENUNCIA_REPETIDA' USING ERRCODE = '23505';
  END;
  FOREACH u IN ARRAY ARRAY[me, owner] LOOP
    r := CASE WHEN u = me THEN 'reporter' ELSE 'reported' END;
    IF NOT EXISTS (SELECT 1 FROM public.moderators WHERE user_id = u) AND NOT public.is_on_hold(u) THEN
      INSERT INTO public.account_holds (user_id, report_id, role, ends_at)
      VALUES (u, rid, r, now() + make_interval(hours => public.hold_hours()));
    END IF;
  END LOOP;
  RETURN rid;
END $$;

-- 'dismiss_bad_faith': descarta, encerra a vigilância e marca a denúncia como de má-fé
CREATE OR REPLACE FUNCTION public.resolve_report(_id uuid, _action text, _note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reports;
BEGIN
  IF NOT public.is_moderator() THEN RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.reports WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023'; END IF;
  IF _action IN ('hide_post', 'restore_post') AND r.target_type <> 'post' THEN
    RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF _action = 'hide_post' THEN
    UPDATE public.posts SET hidden_at = now(), hidden_reason = left(coalesce(_note, ''), 200) WHERE id = r.target_id;
  ELSIF _action = 'restore_post' THEN
    UPDATE public.posts SET hidden_at = NULL, hidden_reason = NULL WHERE id = r.target_id;
  ELSIF _action NOT IN ('dismiss', 'dismiss_bad_faith', 'done') THEN
    RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF _action IN ('dismiss', 'dismiss_bad_faith') THEN
    UPDATE public.account_holds SET lifted_at = now() WHERE report_id = _id AND lifted_at IS NULL;
  END IF;
  UPDATE public.reports
     SET status = CASE WHEN _action IN ('dismiss', 'dismiss_bad_faith') THEN 'dismissed' ELSE 'actioned' END,
         bad_faith = (_action = 'dismiss_bad_faith'),
         resolution_note = left(coalesce(_note, ''), 500), reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = _id;
END $$;

-- o caso mostra quantas denúncias de quem denunciou já foram de má-fé
CREATE OR REPLACE FUNCTION public.reporter_bad_faith(_report uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_moderator() THEN (
    SELECT count(*)::int FROM public.reports x
    WHERE x.bad_faith AND x.reporter_id = (SELECT reporter_id FROM public.reports WHERE id = _report))
  ELSE 0 END
$$;
REVOKE EXECUTE ON FUNCTION public.reporter_bad_faith(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reporter_bad_faith(uuid) TO authenticated;

-- 5) Agendamentos -------------------------------------------------------------------------------------------
SELECT cron.schedule('beecos-limpar-guarda', '20 3 * * *', $$ SELECT public.purge_expired_records() $$);
SELECT cron.schedule('beecos-anexos-48h', '7 * * * *', $$
  SELECT net.http_post(
    url := 'https://qfheectjquxfgmexahem.supabase.co/functions/v1/cleanup-chat-files',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb)
$$);
