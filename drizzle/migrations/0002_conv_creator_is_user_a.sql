DROP POLICY "participants create conv" ON public.conversations;
CREATE POLICY "participants create conv" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_a);