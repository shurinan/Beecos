-- Aviso de vaga nova também para quem está no grupo da profissão (Comunidade), mesmo sem a habilidade
-- cadastrada ou sem o CEP de onde atua. Quem já recebe pelo critério de distância não recebe duas vezes.
-- Depende de 0015/0021 (notify_job_matches) e 0025 (community_members).
CREATE OR REPLACE FUNCTION public.notify_job_matches() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.posts; pname text; sname text;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = NEW.post_id;
  IF NOT FOUND OR p.kind <> 'job' OR p.profession_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO pname FROM public.professions WHERE id = p.profession_id;
  SELECT name INTO sname FROM public.services WHERE id = p.service_id;

  -- 1) quem tem a profissão e atua perto (com a distância no aviso)
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

  -- 2) quem está no grupo da profissão na Comunidade (sem distância: o grupo é por área, não por lugar)
  INSERT INTO public.notifications (user_id, kind, post_id, actor_id, title, body)
  SELECT m.user_id, 'new_job', p.id, p.user_id,
         'Nova vaga no grupo ' || pname,
         left(p.title, 80) || CASE WHEN sname IS NOT NULL THEN ' · ' || sname ELSE '' END
           || CASE WHEN p.city <> '' THEN ' · ' || p.city ELSE '' END
  FROM public.community_members m
  WHERE m.profession_id = p.profession_id
    AND m.user_id <> p.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_prefs n
      WHERE n.user_id = m.user_id
        AND (NOT n.in_app
             OR (n.paused_until IS NOT NULL AND n.paused_until > now())
             OR (p.profession_id = ANY (n.muted_profession_ids) AND public.is_premium(m.user_id))))
  LIMIT 500
  ON CONFLICT (user_id, post_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_job_matches() FROM PUBLIC, anon, authenticated;
