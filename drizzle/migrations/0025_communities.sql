-- Comunidades: um grupo por profissão, com feed das vagas dela. Depende de 0012 (catálogo), 0015, 0022.
-- Quem cadastra uma profissão entra no grupo dela sozinho; pode sair e entrar em outros quando quiser.

CREATE TABLE public.community_members (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profession_id)
);
CREATE INDEX community_members_prof_idx ON public.community_members (profession_id);
REVOKE ALL ON public.community_members FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memberships read" ON public.community_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own memberships join" ON public.community_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own memberships leave" ON public.community_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- No máximo 30 grupos por pessoa (evita abuso e mantém o feed útil).
CREATE FUNCTION public.guard_community_members() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.community_members WHERE user_id = NEW.user_id) >= 30 THEN
    RAISE EXCEPTION 'GRUPOS_DEMAIS' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_community_members() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER community_members_guard BEFORE INSERT ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_community_members();

-- Cadastrar uma profissão nas habilidades coloca a pessoa no grupo (sem erro se já estiver).
CREATE FUNCTION public.join_community_from_skill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.profession_id IS NOT NULL
     AND (SELECT count(*) FROM public.community_members WHERE user_id = NEW.user_id) < 30 THEN
    INSERT INTO public.community_members (user_id, profession_id) VALUES (NEW.user_id, NEW.profession_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.join_community_from_skill() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profile_skills_join_community AFTER INSERT OR UPDATE OF profession_id ON public.profile_skills
  FOR EACH ROW EXECUTE FUNCTION public.join_community_from_skill();

INSERT INTO public.community_members (user_id, profession_id)
SELECT DISTINCT user_id, profession_id FROM public.profile_skills WHERE profession_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Números públicos de cada grupo: quantos participantes e quantas vagas abertas.
CREATE FUNCTION public.community_overview() RETURNS TABLE (profession_id uuid, members integer, open_jobs integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pr.id,
         (SELECT count(*)::int FROM public.community_members m WHERE m.profession_id = pr.id),
         (SELECT count(*)::int FROM public.posts p
            JOIN public.post_stats s ON s.post_id = p.id
           WHERE p.profession_id = pr.id AND p.kind = 'job' AND p.hidden_at IS NULL AND s.taken < s.vacancies)
  FROM public.professions pr WHERE pr.active
$$;
REVOKE ALL ON FUNCTION public.community_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_overview() TO anon, authenticated;

-- "Inscritos": quantas pessoas estão negociando cada vaga agora (só o número).
CREATE FUNCTION public.post_interest_counts(_post_ids uuid[]) RETURNS TABLE (post_id uuid, interested integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, public.open_negotiations(p.id)
  FROM public.posts p WHERE p.id = ANY (_post_ids) AND p.hidden_at IS NULL
  LIMIT 100
$$;
REVOKE ALL ON FUNCTION public.post_interest_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_interest_counts(uuid[]) TO anon, authenticated;
