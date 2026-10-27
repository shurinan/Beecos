-- 1) Busca que entende apelidos e acentos; 2) Premium escolhe de quais profissões recebe avisos;
-- 3) mais palavras reservadas. Depende de 0011 (search_post_ids), 0012 (catálogo), 0015 (avisos), 0018/0019.

-- 1) Busca ---------------------------------------------------------------------------------------
-- "eletricista" acha "Instalação elétrica"; "pedreiro" acha "Alvenaria"; "agua" acha "água". Cada palavra
-- digitada precisa aparecer em algum lugar da vaga: título, descrição, profissão (nome e apelidos),
-- serviço (nome e apelidos), cidade ou habilidades de quem publicou.
CREATE FUNCTION public.fold_text(_t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(translate(coalesce(_t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
$$;
REVOKE EXECUTE ON FUNCTION public.fold_text(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fold_text(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_post_ids(
  _kind text,
  _city text DEFAULT '',
  _q text DEFAULT '',
  _min_price numeric DEFAULT NULL,
  _max_price numeric DEFAULT NULL,
  _min_rating numeric DEFAULT NULL,
  _only_premium boolean DEFAULT false,
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

-- 2) Premium: escolher de quais profissões receber avisos ---------------------------------------
ALTER TABLE public.notification_prefs ADD COLUMN muted_profession_ids uuid[] NOT NULL DEFAULT '{}';

-- Só Premium silencia profissões; no Grátis a lista volta a ficar vazia.
CREATE FUNCTION public.guard_notification_prefs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_premium(NEW.user_id) THEN NEW.muted_profession_ids := '{}'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_notification_prefs() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notification_prefs_guard BEFORE INSERT OR UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.guard_notification_prefs();

-- O aviso respeita a lista só enquanto a pessoa é Premium (se o plano acabar, volta a receber de tudo).
CREATE OR REPLACE FUNCTION public.notify_job_matches() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.posts; pname text; sname text;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = NEW.post_id;
  IF NOT FOUND OR p.kind <> 'job' OR p.profession_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO pname FROM public.professions WHERE id = p.profession_id;
  SELECT name INTO sname FROM public.services WHERE id = p.service_id;

  INSERT INTO public.notifications (user_id, kind, post_id, actor_id, title, body)
  SELECT w.user_id, 'new_job', p.id, p.user_id,
         'Nova vaga de ' || lower(pname) || ' perto de você',
         left(p.title, 80) || CASE WHEN sname IS NOT NULL THEN ' · ' || sname ELSE '' END
           || ' · a ' || replace(round(public.haversine_km(w.lat, w.lng, NEW.lat, NEW.lng)::numeric, 1)::text, '.', ',') || ' km'
  FROM public.work_areas w
  WHERE w.user_id <> p.user_id
    AND EXISTS (SELECT 1 FROM public.profile_skills s WHERE s.user_id = w.user_id AND s.profession_id = p.profession_id)
    AND public.haversine_km(w.lat, w.lng, NEW.lat, NEW.lng) <= public.effective_radius_km(w.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_prefs n
      WHERE n.user_id = w.user_id
        AND (NOT n.in_app
             OR (n.paused_until IS NOT NULL AND n.paused_until > now())
             OR (p.profession_id = ANY (n.muted_profession_ids) AND public.is_premium(w.user_id))))
  LIMIT 500
  ON CONFLICT (user_id, post_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_job_matches() FROM PUBLIC, anon, authenticated;

-- 3) Endereços novos que o app usa ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserved_usernames() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['contato', 'editar', 'novo', 'eu', 'comunidade', 'vagas', 'perfil', 'conversas', 'avisos',
               'auth', 'admin', 'api', 'painel', 'mensagens', 'publicacao', 'suporte', 'beecos', 'outros',
               'usuario', 'ajuda', 'sobre', 'termos', 'privacidade', 'plano', 'moderacao', 'denuncia',
               'denuncias', 'planos', 'login', 'cadastro', 'configuracoes', 'lgpd']
$$;
