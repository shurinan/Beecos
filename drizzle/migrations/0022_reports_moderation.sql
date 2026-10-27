-- Denúncias com moderação humana. Nada é bloqueado automaticamente: a denúncia entra numa fila e só um
-- moderador decide (descartar, ocultar a vaga ou marcar como tratada). Depende de 0017 (posts.slug).

-- Moderadores: quem está nesta lista. Ninguém lê nem escreve por aqui pelo app; só o dono do projeto,
-- direto no banco:  INSERT INTO public.moderators (user_id) VALUES ('<id do perfil>');
CREATE TABLE public.moderators (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.moderators FROM anon, authenticated;
GRANT ALL ON public.moderators TO service_role;
ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.is_moderator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.moderators WHERE user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_moderator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO anon, authenticated;

-- Vaga oculta pela moderação: some das listas e das buscas; o dono e os moderadores continuam vendo.
ALTER TABLE public.posts ADD COLUMN hidden_at timestamptz, ADD COLUMN hidden_reason text;
DROP POLICY "posts readable" ON public.posts;
CREATE POLICY "posts readable" ON public.posts FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL OR user_id = auth.uid() OR public.is_moderator());

-- Só a moderação mexe nos campos de ocultação (o dono não "desoculta" a própria vaga).
CREATE FUNCTION public.guard_post_hidden() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.hidden_at := NULL; NEW.hidden_reason := NULL;
  ELSIF (NEW.hidden_at IS DISTINCT FROM OLD.hidden_at OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason)
        AND NOT public.is_moderator() THEN
    NEW.hidden_at := OLD.hidden_at; NEW.hidden_reason := OLD.hidden_reason;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_post_hidden() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER posts_hidden_guard BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_hidden();

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'profile')),
  target_id uuid NOT NULL,
  -- o que estava escrito quando foi denunciado (a pessoa pode editar depois)
  target_label text NOT NULL DEFAULT '',
  reason text NOT NULL CHECK (reason IN ('golpe', 'ofensivo', 'falso', 'contato_externo', 'outro')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  resolution_note text NOT NULL DEFAULT '' CHECK (char_length(resolution_note) <= 500),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- uma denúncia aberta por pessoa e alvo (evita repetir)
CREATE UNIQUE INDEX reports_one_open ON public.reports (reporter_id, target_type, target_id) WHERE status = 'open';
CREATE INDEX reports_queue_idx ON public.reports (status, created_at);
REVOKE ALL ON public.reports FROM anon, authenticated;
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or moderator reports read" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_moderator());

CREATE FUNCTION public.report_content(_type text, _target uuid, _reason text, _details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); label text; owner uuid; rid uuid;
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
    INSERT INTO public.reports (reporter_id, target_type, target_id, target_label, reason, details)
    VALUES (me, _type, _target, coalesce(label, ''), _reason, left(coalesce(_details, ''), 500))
    RETURNING id INTO rid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'DENUNCIA_REPETIDA' USING ERRCODE = '23505';
  END;
  RETURN rid;
END $$;
REVOKE EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) TO authenticated;

-- Decisão do moderador. Ações: 'dismiss' (descartar), 'hide_post' (ocultar a vaga), 'restore_post'
-- (reexibir), 'done' (tratada por outro meio).
CREATE FUNCTION public.resolve_report(_id uuid, _action text, _note text DEFAULT '')
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
  UPDATE public.reports
     SET status = CASE WHEN _action = 'dismiss' THEN 'dismissed' ELSE 'actioned' END,
         resolution_note = left(coalesce(_note, ''), 500), reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, text, text) TO authenticated;

-- A busca também esconde as vagas ocultas (a função roda como dono do banco e ignora o RLS).
CREATE OR REPLACE FUNCTION public.search_post_ids(
  _kind text, _city text DEFAULT '', _q text DEFAULT '', _min_price numeric DEFAULT NULL,
  _max_price numeric DEFAULT NULL, _min_rating numeric DEFAULT NULL, _only_premium boolean DEFAULT false,
  _limit integer DEFAULT 50
) RETURNS TABLE (id uuid, premium boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (
    SELECT '%' || replace(replace(replace(btrim(coalesce(_city, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS city,
           array_remove(string_to_array(public.fold_text(btrim(coalesce(_q, ''))), ' '), '') AS words
  )
  SELECT p.id, (pr.user_id IS NOT NULL) AS premium
  FROM public.posts p
  CROSS JOIN f
  LEFT JOIN public.premium_users pr ON pr.user_id = p.user_id
  LEFT JOIN public.professions pf ON pf.id = p.profession_id
  LEFT JOIN public.services sv ON sv.id = p.service_id
  LEFT JOIN LATERAL (
    SELECT avg(rv.rating) AS avg_rating FROM public.reviews rv WHERE rv.reviewee_id = p.user_id
  ) r ON true
  CROSS JOIN LATERAL (
    SELECT public.fold_text(concat_ws(' ',
      p.title, p.description, p.city,
      pf.name, array_to_string(pf.aliases, ' '),
      sv.name, array_to_string(sv.aliases, ' '),
      (SELECT string_agg(s.skill, ' ') FROM public.profile_skills s WHERE s.user_id = p.user_id)
    )) AS doc
  ) d
  WHERE p.kind = _kind
    AND p.hidden_at IS NULL
    AND (btrim(coalesce(_city, '')) = '' OR p.city ILIKE f.city)
    AND NOT EXISTS (SELECT 1 FROM unnest(f.words) w WHERE position(w IN d.doc) = 0)
    AND (_min_price IS NULL OR p.price_value >= _min_price)
    AND (_max_price IS NULL OR p.price_value <= _max_price)
    AND (_min_rating IS NULL OR r.avg_rating >= _min_rating)
    AND (NOT coalesce(_only_premium, false) OR pr.user_id IS NOT NULL)
  ORDER BY (pr.user_id IS NOT NULL) DESC, p.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 100)
$$;
REVOKE ALL ON FUNCTION public.search_post_ids(text, text, text, numeric, numeric, numeric, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_post_ids(text, text, text, numeric, numeric, numeric, boolean, integer) TO anon, authenticated;
