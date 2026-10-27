-- Depende da 0003 (profile_private).

-- 1. Perfil mais completo -----------------------------------------------------
-- Dados profissionais (públicos, ficam em profiles)
ALTER TABLE public.profiles
  ADD COLUMN headline text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 80),
  ADD COLUMN experience_years smallint CHECK (experience_years BETWEEN 0 AND 60),
  ADD COLUMN service_area text NOT NULL DEFAULT '' CHECK (char_length(service_area) <= 120),
  ADD COLUMN certificate_note text NOT NULL DEFAULT '' CHECK (char_length(certificate_note) <= 200);

-- Dados pessoais (privados, só o dono vê)
ALTER TABLE public.profile_private
  ADD COLUMN birth_date date CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');

-- 2. Habilidades com nível (1 = "Sei fazer" ... 5 = "Profissional certificado") ----
CREATE TABLE public.profile_skills (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill text NOT NULL CHECK (char_length(skill) BETWEEN 1 AND 40),
  level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill)
);
GRANT SELECT ON public.profile_skills TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_skills TO authenticated;
GRANT ALL ON public.profile_skills TO service_role;
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills readable" ON public.profile_skills FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own skills insert" ON public.profile_skills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own skills update" ON public.profile_skills FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own skills delete" ON public.profile_skills FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_skill_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.profile_skills WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'LIMITE_HABILIDADES';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profile_skills_limit BEFORE INSERT ON public.profile_skills
FOR EACH ROW EXECUTE FUNCTION public.enforce_skill_limit();

-- Habilidades que já existiam entram no nível 1 ("Sei fazer").
INSERT INTO public.profile_skills (user_id, skill, level)
SELECT p.id, left(btrim(s), 40), 1
FROM public.profiles p, unnest(p.skills) AS s
WHERE btrim(s) <> ''
ON CONFLICT (user_id, skill) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN skills;

-- 3. Avaliações --------------------------------------------------------------
-- Só avalia quem realmente conversou: a conversa precisa ter mensagem dos dois lados.
CREATE OR REPLACE FUNCTION public.can_review(_reviewer uuid, _reviewee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _reviewer <> _reviewee AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE ((c.user_a = _reviewer AND c.user_b = _reviewee) OR (c.user_a = _reviewee AND c.user_b = _reviewer))
      AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.sender_id = _reviewer)
      AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.sender_id = _reviewee)
  )
$$;
REVOKE ALL ON FUNCTION public.can_review(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_review(uuid, uuid) TO authenticated;

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, reviewee_id),
  CHECK (reviewer_id <> reviewee_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, DELETE ON public.reviews TO authenticated;
GRANT UPDATE (rating, comment) ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews readable" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "partners review" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid() AND public.can_review(reviewer_id, reviewee_id));
CREATE POLICY "own review update" ON public.reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid()) WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "own review delete" ON public.reviews FOR DELETE TO authenticated USING (reviewer_id = auth.uid());

CREATE VIEW public.profile_rating_stats WITH (security_invoker = true) AS
SELECT reviewee_id AS user_id, count(*)::int AS review_count, round(avg(rating)::numeric, 1) AS avg_rating
FROM public.reviews
GROUP BY reviewee_id;
GRANT SELECT ON public.profile_rating_stats TO anon, authenticated;
GRANT ALL ON public.profile_rating_stats TO service_role;

-- 4. Anúncios -----------------------------------------------------------------
-- Leitura pública só dos ativos e dentro da janela de datas. Quem cadastra/edita
-- anúncios é o dono do app (painel do Supabase / service_role), nunca o usuário.
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement text NOT NULL CHECK (placement IN ('feed', 'profile')),
  sponsor text NOT NULL CHECK (char_length(sponsor) BETWEEN 1 AND 60),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 160),
  image_url text CHECK (image_url IS NULL OR image_url ~* '^https://'),
  link_url text NOT NULL CHECK (link_url ~* '^https?://'),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active ads readable" ON public.ads FOR SELECT TO anon, authenticated
  USING (active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
