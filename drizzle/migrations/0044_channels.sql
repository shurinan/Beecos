-- Canais (empresas agrupam as vagas num lugar), prazo das vagas e ofertas concluídas.
-- Depende de 0001 (is_premium), 0012 (professions), 0015 (notifications), 0022/0030/0035 (denúncias) e 0011 (conversations.post_id).

-- 1) Canais ---------------------------------------------------------------------------------------------------
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 60),
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  default_days smallint NOT NULL DEFAULT 7 CHECK (default_days IN (1, 3, 7, 30)),
  hidden_at timestamptz,
  hidden_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX channels_owner_idx ON public.channels (owner_id);

CREATE TABLE public.channel_professions (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, profession_id)
);
CREATE INDEX channel_professions_prof_idx ON public.channel_professions (profession_id);

CREATE TABLE public.channel_follows (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX channel_follows_user_idx ON public.channel_follows (user_id);

-- endereço do canal: nome sem acento e sem símbolos + 4 letras para não repetir
CREATE FUNCTION public.channel_before_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_premium(NEW.owner_id) THEN RAISE EXCEPTION 'CANAL_SO_PREMIUM' USING ERRCODE = '42501'; END IF;
    IF (SELECT count(*) FROM public.channels WHERE owner_id = NEW.owner_id) >= 3 THEN
      RAISE EXCEPTION 'LIMITE_CANAIS' USING ERRCODE = '54000';
    END IF;
    base := btrim(regexp_replace(public.fold_text(NEW.name), '[^a-z0-9]+', '-', 'g'), '-');
    NEW.slug := left(coalesce(nullif(base, ''), 'canal'), 40) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    NEW.hidden_at := NULL; NEW.hidden_reason := NULL;
  ELSE
    NEW.slug := OLD.slug; NEW.owner_id := OLD.owner_id;
    IF (NEW.hidden_at IS DISTINCT FROM OLD.hidden_at OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason)
       AND NOT public.is_moderator() THEN
      NEW.hidden_at := OLD.hidden_at; NEW.hidden_reason := OLD.hidden_reason;
    END IF;
  END IF;
  NEW.name := btrim(NEW.name);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.channel_before_write() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER channels_before_write BEFORE INSERT OR UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.channel_before_write();

CREATE FUNCTION public.channel_professions_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.channel_professions WHERE channel_id = NEW.channel_id) >= 8 THEN
    RAISE EXCEPTION 'LIMITE_OFICIOS_CANAL' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.channel_professions_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER channel_professions_limit BEFORE INSERT ON public.channel_professions
  FOR EACH ROW EXECUTE FUNCTION public.channel_professions_limit();

REVOKE ALL ON public.channels, public.channel_professions, public.channel_follows FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.channel_professions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.channel_follows TO authenticated;
GRANT ALL ON public.channels, public.channel_professions, public.channel_follows TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels read" ON public.channels FOR SELECT TO authenticated
  USING (hidden_at IS NULL OR owner_id = auth.uid() OR public.is_moderator());
CREATE POLICY "channels insert" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "channels update" ON public.channels FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_moderator()) WITH CHECK (owner_id = auth.uid() OR public.is_moderator());
CREATE POLICY "channels delete" ON public.channels FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "channel profs read" ON public.channel_professions FOR SELECT TO authenticated USING (true);
CREATE POLICY "channel profs insert" ON public.channel_professions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.owner_id = auth.uid()));
CREATE POLICY "channel profs delete" ON public.channel_professions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.owner_id = auth.uid()));

CREATE POLICY "follows own read" ON public.channel_follows FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "follows own insert" ON public.channel_follows FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.hidden_at IS NULL));
CREATE POLICY "follows own delete" ON public.channel_follows FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) Prazo, canal e conclusão nas vagas ------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN closed_at timestamptz;
CREATE INDEX posts_channel_idx ON public.posts (channel_id, created_at DESC) WHERE channel_id IS NOT NULL;

-- vaga nova sempre tem prazo (no máximo 30 dias); só o dono pode ter canal próprio
CREATE FUNCTION public.post_deadline_and_channel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'job' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.expires_at := least(greatest(coalesce(NEW.expires_at, now() + interval '30 days'), now() + interval '1 hour'),
                              now() + interval '30 days');
    ELSE
      NEW.expires_at := CASE WHEN OLD.expires_at IS NULL THEN OLD.expires_at
                             ELSE least(coalesce(NEW.expires_at, OLD.expires_at), OLD.created_at + interval '30 days') END;
    END IF;
  ELSE
    NEW.expires_at := NULL; NEW.channel_id := NULL; NEW.closed_at := NULL;
  END IF;
  IF NEW.channel_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.channels c WHERE c.id = NEW.channel_id AND c.owner_id = NEW.user_id AND c.hidden_at IS NULL) THEN
    RAISE EXCEPTION 'CANAL_INVALIDO' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.post_deadline_and_channel() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER posts_deadline_channel BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.post_deadline_and_channel();

-- Vaga encerrada (prazo, concluída ou oculta) some para os outros; dono, moderação e quem já conversa sobre ela continuam vendo.
DROP POLICY "posts readable" ON public.posts;
CREATE POLICY "posts readable" ON public.posts FOR SELECT TO anon, authenticated
  USING (
    (hidden_at IS NULL AND (
       (closed_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
       OR EXISTS (SELECT 1 FROM public.conversations c
                  WHERE c.post_id = posts.id AND (c.user_a = auth.uid() OR c.user_b = auth.uid()))))
    OR user_id = auth.uid() OR public.is_moderator());

-- Quem segue o canal recebe aviso de vaga nova (mesmo sistema dos avisos por profissão).
CREATE FUNCTION public.notify_channel_followers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cname text;
BEGIN
  IF NEW.channel_id IS NULL OR NEW.kind <> 'job' THEN RETURN NEW; END IF;
  SELECT name INTO cname FROM public.channels WHERE id = NEW.channel_id;
  INSERT INTO public.notifications (user_id, kind, post_id, actor_id, title, body)
  SELECT f.user_id, 'new_job', NEW.id, NEW.user_id, 'Nova vaga no canal ' || cname, left(NEW.title, 80)
  FROM public.channel_follows f
  WHERE f.user_id <> NEW.user_id
    AND NOT EXISTS (SELECT 1 FROM public.notification_prefs n
                    WHERE n.user_id = f.user_id AND (NOT n.in_app OR (n.paused_until IS NOT NULL AND n.paused_until > now())))
  LIMIT 1000
  ON CONFLICT (user_id, post_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_channel_followers() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER posts_notify_channel AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_channel_followers();

-- 3) Números públicos e ofertas concluídas -------------------------------------------------------------------------
CREATE FUNCTION public.channel_overview(_ids uuid[])
RETURNS TABLE (channel_id uuid, followers integer, open_jobs integer, following boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,
         (SELECT count(*)::int FROM public.channel_follows f WHERE f.channel_id = c.id),
         (SELECT count(*)::int FROM public.posts p
           WHERE p.channel_id = c.id AND p.kind = 'job' AND p.hidden_at IS NULL AND p.closed_at IS NULL
             AND (p.expires_at IS NULL OR p.expires_at > now())),
         EXISTS (SELECT 1 FROM public.channel_follows f WHERE f.channel_id = c.id AND f.user_id = auth.uid())
  FROM public.channels c
  WHERE c.id = ANY (_ids[1:100]) AND (c.hidden_at IS NULL OR c.owner_id = auth.uid() OR public.is_moderator())
$$;
REVOKE EXECUTE ON FUNCTION public.channel_overview(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.channel_overview(uuid[]) TO authenticated;

CREATE FUNCTION public.closed_offers(_user uuid)
RETURNS TABLE (title text, profession text, ended_at timestamptz, concluded boolean, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.title, pf.name, coalesce(p.closed_at, p.expires_at), (p.closed_at IS NOT NULL), (count(*) OVER ())::int
  FROM public.posts p
  LEFT JOIN public.professions pf ON pf.id = p.profession_id
  WHERE p.user_id = _user AND p.kind = 'job' AND p.hidden_at IS NULL
    AND (p.closed_at IS NOT NULL OR p.expires_at <= now())
  ORDER BY coalesce(p.closed_at, p.expires_at) DESC
  LIMIT 20
$$;
REVOKE EXECUTE ON FUNCTION public.closed_offers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.closed_offers(uuid) TO authenticated;

-- 4) Denúncia e moderação de canal (igual às vagas) -----------------------------------------------------------------
ALTER TABLE public.reports DROP CONSTRAINT reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check CHECK (target_type IN ('post', 'profile', 'channel'));

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
  ELSIF _type = 'channel' THEN
    SELECT left(name, 120), owner_id INTO label, owner FROM public.channels WHERE id = _target AND hidden_at IS NULL;
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
  IF _action IN ('hide_channel', 'restore_channel') AND r.target_type <> 'channel' THEN
    RAISE EXCEPTION 'DENUNCIA_INVALIDA' USING ERRCODE = '22023';
  END IF;
  IF _action = 'hide_post' THEN
    UPDATE public.posts SET hidden_at = now(), hidden_reason = left(coalesce(_note, ''), 200) WHERE id = r.target_id;
  ELSIF _action = 'restore_post' THEN
    UPDATE public.posts SET hidden_at = NULL, hidden_reason = NULL WHERE id = r.target_id;
  ELSIF _action = 'hide_channel' THEN
    UPDATE public.channels SET hidden_at = now(), hidden_reason = left(coalesce(_note, ''), 200) WHERE id = r.target_id;
  ELSIF _action = 'restore_channel' THEN
    UPDATE public.channels SET hidden_at = NULL, hidden_reason = NULL WHERE id = r.target_id;
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
