DROP POLICY IF EXISTS "reviews readable" ON public.reviews;
CREATE POLICY "reviews readable by signed in" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.reviews FROM anon;

DROP POLICY IF EXISTS "skills readable" ON public.profile_skills;
CREATE POLICY "skills readable by signed in" ON public.profile_skills FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profile_skills FROM anon;

DROP POLICY IF EXISTS "profiles readable" ON public.profiles;
CREATE POLICY "profiles readable by signed in" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profiles FROM anon;