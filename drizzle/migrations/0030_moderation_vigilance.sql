-- Moderação aprofundada: (1) nada que for apagado some de verdade, (2) vigilância de 2 horas nas duas contas
-- de uma denúncia, (3) painel do caso para os moderadores, com registro de cada acesso.
-- Depende de 0022 (reports, moderators) e 0010/0016 (engagements, conversation_posts). Nova versão dos Termos.

-- 1) Quem foi denunciado (o dono da vaga ou o próprio perfil) ---------------------------------------------
ALTER TABLE public.reports ADD COLUMN reported_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
UPDATE public.reports r SET reported_id = CASE r.target_type
  WHEN 'post' THEN (SELECT p.user_id FROM public.posts p WHERE p.id = r.target_id)
  ELSE r.target_id END;
CREATE INDEX reports_reported_idx ON public.reports (reported_id);

-- 2) Arquivo do que foi apagado: cópia da linha no momento da exclusão (inclui exclusão de conta) ---------
CREATE TABLE public.deleted_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  record_id text,
  record jsonb NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deleted_records_lookup ON public.deleted_records (table_name, deleted_at DESC);
REVOKE ALL ON public.deleted_records FROM anon, authenticated;
GRANT ALL ON public.deleted_records TO service_role;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY; -- ninguém lê direto: só pelo painel do caso

CREATE FUNCTION public.archive_deleted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.deleted_records (table_name, record_id, record, deleted_by)
  VALUES (TG_TABLE_NAME, to_jsonb(OLD) ->> 'id', to_jsonb(OLD), auth.uid());
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.archive_deleted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER posts_archive AFTER DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.archive_deleted();
CREATE TRIGGER messages_archive AFTER DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.archive_deleted();
CREATE TRIGGER conversations_archive AFTER DELETE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.archive_deleted();
CREATE TRIGGER reviews_archive AFTER DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.archive_deleted();
CREATE TRIGGER engagements_archive AFTER DELETE ON public.engagements FOR EACH ROW EXECUTE FUNCTION public.archive_deleted();
CREATE TRIGGER profiles_archive AFTER DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.archive_deleted();

-- 3) Vigilância: 2 horas sem negociar, publicar vagas nem receber propostas ---------------------------------
CREATE TABLE public.account_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('reporter', 'reported')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  lifted_at timestamptz
);
CREATE INDEX account_holds_active ON public.account_holds (user_id, ends_at);
REVOKE ALL ON public.account_holds FROM anon, authenticated;
GRANT ALL ON public.account_holds TO service_role;
ALTER TABLE public.account_holds ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.hold_hours() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;

CREATE FUNCTION public.is_on_hold(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.account_holds WHERE user_id = _u AND lifted_at IS NULL AND ends_at > now())
$$;
REVOKE EXECUTE ON FUNCTION public.is_on_hold(uuid) FROM PUBLIC, anon, authenticated;

-- Para o aviso na tela: até quando a minha conta está em vigilância (NULL = não está)
CREATE FUNCTION public.my_hold_until() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(ends_at) FROM public.account_holds WHERE user_id = auth.uid() AND lifted_at IS NULL AND ends_at > now()
$$;
REVOKE EXECUTE ON FUNCTION public.my_hold_until() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_hold_until() TO authenticated;

-- Denunciar: grava quem foi denunciado e coloca as DUAS contas em vigilância (moderadores não entram)
CREATE OR REPLACE FUNCTION public.report_content(_type text, _target uuid, _reason text, _details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); label text; owner uuid; rid uuid; u uuid; r text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
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
  -- vigilância nas duas contas; quem já está em vigilância não tem o prazo estendido (evita travar alguém sem fim)
  FOREACH u IN ARRAY ARRAY[me, owner] LOOP
    r := CASE WHEN u = me THEN 'reporter' ELSE 'reported' END;
    IF NOT EXISTS (SELECT 1 FROM public.moderators WHERE user_id = u) AND NOT public.is_on_hold(u) THEN
      INSERT INTO public.account_holds (user_id, report_id, role, ends_at)
      VALUES (u, rid, r, now() + make_interval(hours => public.hold_hours()));
    END IF;
  END LOOP;
  RETURN rid;
END $$;

-- Descartar uma denúncia encerra a vigilância dela; as demais decisões deixam o prazo correr
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
  ELSIF _action NOT IN ('dismiss', 'done') THEN
    RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF _action = 'dismiss' THEN
    UPDATE public.account_holds SET lifted_at = now() WHERE report_id = _id AND lifted_at IS NULL;
  END IF;
  UPDATE public.reports
     SET status = CASE WHEN _action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END,
         resolution_note = left(coalesce(_note, ''), 500), reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = _id;
END $$;

-- As travas. A mensagem é a mesma para quem denunciou e para quem foi denunciado (não revela quem é quem).
CREATE FUNCTION public.guard_hold_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_on_hold(NEW.user_id) THEN
    RAISE EXCEPTION 'CONTA_EM_ANALISE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.guard_hold_conversation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (public.is_on_hold(NEW.user_a) OR public.is_on_hold(NEW.user_b)) THEN
    RAISE EXCEPTION 'CONTA_EM_ANALISE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.guard_hold_conversation_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.conversations;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.conversations WHERE id = NEW.conversation_id;
  IF FOUND AND (public.is_on_hold(c.user_a) OR public.is_on_hold(c.user_b)) THEN
    RAISE EXCEPTION 'CONTA_EM_ANALISE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.guard_hold_engagement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IN ('proposed', 'accepted') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND (public.is_on_hold(NEW.client_id) OR public.is_on_hold(NEW.provider_id)) THEN
    RAISE EXCEPTION 'CONTA_EM_ANALISE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.guard_hold_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.conversations;
BEGIN
  IF auth.uid() IS NULL OR NEW.kind <> 'user' THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.conversations WHERE id = NEW.conversation_id;
  IF FOUND AND (public.is_on_hold(c.user_a) OR public.is_on_hold(c.user_b)) THEN
    RAISE EXCEPTION 'CONTA_EM_ANALISE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_hold_post(), public.guard_hold_conversation(), public.guard_hold_conversation_post(),
  public.guard_hold_engagement(), public.guard_hold_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER posts_hold_guard BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.guard_hold_post();
CREATE TRIGGER conversations_hold_guard BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.guard_hold_conversation();
CREATE TRIGGER conversation_posts_hold_guard BEFORE INSERT ON public.conversation_posts FOR EACH ROW EXECUTE FUNCTION public.guard_hold_conversation_post();
CREATE TRIGGER engagements_hold_guard BEFORE INSERT OR UPDATE ON public.engagements FOR EACH ROW EXECUTE FUNCTION public.guard_hold_engagement();
CREATE TRIGGER messages_hold_guard BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_hold_message();

-- 4) Painel do caso (só moderador), com registro de cada acesso ---------------------------------------------
CREATE TABLE public.moderator_access_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  moderator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_id uuid,
  what text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.moderator_access_log FROM anon, authenticated;
GRANT ALL ON public.moderator_access_log TO service_role;
ALTER TABLE public.moderator_access_log ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.moderator_case(_report uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reports; cid uuid; res jsonb;
BEGIN
  IF NOT public.is_moderator() THEN RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.reports WHERE id = _report;
  IF NOT FOUND THEN RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.moderator_access_log (moderator_id, report_id, what) VALUES (auth.uid(), _report, 'abriu o caso');
  SELECT id INTO cid FROM public.conversations
   WHERE least(user_a, user_b) = least(r.reporter_id, r.reported_id)
     AND greatest(user_a, user_b) = greatest(r.reporter_id, r.reported_id);
  res := jsonb_build_object(
    'reporter', (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'slug', p.slug, 'created_at', p.created_at)
                 FROM public.profiles p WHERE p.id = r.reporter_id),
    'reported', (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'slug', p.slug, 'created_at', p.created_at)
                 FROM public.profiles p WHERE p.id = r.reported_id),
    'reports_against', (SELECT count(*) FROM public.reports x WHERE x.reported_id = r.reported_id),
    'holds', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', h.user_id, 'role', h.role, 'ends_at', h.ends_at, 'lifted_at', h.lifted_at)), '[]'::jsonb)
              FROM public.account_holds h WHERE h.report_id = _report),
    'target_post', coalesce(
       (SELECT to_jsonb(p) FROM public.posts p WHERE p.id = r.target_id AND r.target_type = 'post'),
       (SELECT d.record FROM public.deleted_records d WHERE d.table_name = 'posts' AND d.record_id = r.target_id::text
         ORDER BY d.deleted_at DESC LIMIT 1)),
    'target_removed', (r.target_type = 'post' AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = r.target_id)),
    'reported_posts', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'kind', p.kind,
                        'hidden_at', p.hidden_at, 'created_at', p.created_at) ORDER BY p.created_at DESC), '[]'::jsonb)
                       FROM (SELECT * FROM public.posts WHERE user_id = r.reported_id ORDER BY created_at DESC LIMIT 20) p),
    'deleted_posts', (SELECT coalesce(jsonb_agg(jsonb_build_object('title', d.record ->> 'title', 'description', d.record ->> 'description',
                        'deleted_at', d.deleted_at) ORDER BY d.deleted_at DESC), '[]'::jsonb)
                      FROM (SELECT * FROM public.deleted_records WHERE table_name = 'posts' AND record ->> 'user_id' = r.reported_id::text
                            ORDER BY deleted_at DESC LIMIT 20) d),
    'conversation_id', cid,
    'messages', CASE WHEN cid IS NULL THEN '[]'::jsonb ELSE
       (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'sender_id', m.sender_id, 'content', m.content, 'created_at', m.created_at,
                 'attachment_path', m.attachment_path, 'attachment_name', m.attachment_name, 'attachment_type', m.attachment_type,
                 'removed', false) ORDER BY m.created_at), '[]'::jsonb)
        FROM (SELECT * FROM public.messages WHERE conversation_id = cid AND kind = 'user' ORDER BY created_at DESC LIMIT 300) m) END,
    'deleted_messages', CASE WHEN cid IS NULL THEN '[]'::jsonb ELSE
       (SELECT coalesce(jsonb_agg(jsonb_build_object('sender_id', d.record ->> 'sender_id', 'content', d.record ->> 'content',
                 'created_at', d.record ->> 'created_at', 'deleted_at', d.deleted_at) ORDER BY d.deleted_at), '[]'::jsonb)
        FROM public.deleted_records d WHERE d.table_name = 'messages' AND d.record ->> 'conversation_id' = cid::text) END
  );
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.moderator_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_case(uuid) TO authenticated;

-- Moderador vê os arquivos do chat só da conversa entre quem denunciou e quem foi denunciado
CREATE POLICY "moderator reads reported chat files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND public.is_moderator() AND EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.conversations c ON c.id::text = (storage.foldername(name))[1]
    WHERE r.reported_id IS NOT NULL
      AND least(c.user_a, c.user_b) = least(r.reporter_id, r.reported_id)
      AND greatest(c.user_a, c.user_b) = greatest(r.reporter_id, r.reported_id)));

-- 5) Nova versão dos Termos (todos precisam aceitar de novo)
CREATE OR REPLACE FUNCTION public.current_terms_version() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-10-28' $$;
