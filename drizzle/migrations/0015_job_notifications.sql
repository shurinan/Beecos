-- Avisos dentro do app: quem publica uma vaga avisa os profissionais da mesma profissão que atuam por perto.
-- Depende de 0012 (catálogo, profile_skills.profession_id), 0013 (work_areas, raio) e 0014 (post_locations).
-- Preferências: pausar ou desligar os avisos é grátis. Raio maior e demais preferências são do plano pago.

CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- avisos no app: ligado por padrão
  in_app boolean NOT NULL DEFAULT true,
  -- canais que ainda vão chegar (e-mail e push); já ficam guardados para respeitar a escolha desde o início
  email boolean NOT NULL DEFAULT false,
  push boolean NOT NULL DEFAULT false,
  -- pausa temporária (férias, por exemplo)
  paused_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.notification_prefs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs read" ON public.notification_prefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs insert" ON public.notification_prefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.notification_prefs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notification_prefs_touch BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('new_job')),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  -- quem publicou: o aviso leva ao perfil dele, de onde se conversa
  actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE UNIQUE INDEX notifications_once ON public.notifications (user_id, post_id, kind);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
-- Só leitura, e marcar como lida (única coluna que a pessoa altera). Quem cria é o banco.
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Ao guardar o local de uma vaga (é o último passo da publicação), avisa quem atua perto e tem a profissão.
CREATE FUNCTION public.notify_job_matches() RETURNS trigger
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
      WHERE n.user_id = w.user_id AND (NOT n.in_app OR (n.paused_until IS NOT NULL AND n.paused_until > now())))
  LIMIT 500
  ON CONFLICT (user_id, post_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_job_matches() FROM PUBLIC, anon, authenticated;
-- só na criação: editar a vaga não avisa de novo
CREATE TRIGGER post_locations_notify AFTER INSERT ON public.post_locations
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_matches();
