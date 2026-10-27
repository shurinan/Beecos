-- Caixa de sugestões: qualquer pessoa logada envia uma ideia; só moderadores leem e marcam como lida.
CREATE TABLE public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'done')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX suggestions_status_idx ON public.suggestions (status, created_at DESC);
REVOKE ALL ON public.suggestions FROM anon, authenticated;
GRANT SELECT, UPDATE (status), INSERT (user_id, body) ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suggestions insert own" ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "suggestions moderators read" ON public.suggestions FOR SELECT TO authenticated
  USING (public.is_moderator());
CREATE POLICY "suggestions moderators update" ON public.suggestions FOR UPDATE TO authenticated
  USING (public.is_moderator()) WITH CHECK (public.is_moderator());

-- No máximo 5 sugestões por dia por pessoa.
CREATE FUNCTION public.guard_suggestions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.suggestions
      WHERE user_id = NEW.user_id AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'SUGESTOES_DEMAIS';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_suggestions() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER suggestions_guard BEFORE INSERT ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.guard_suggestions();

-- Bruno e Junior: moderadores e Premium vitalício (sem data de fim). Repetir é inofensivo.
INSERT INTO public.moderators (user_id)
  SELECT id FROM public.profiles WHERE slug IN ('bruno-espindola', 'junior-ferreira')
  ON CONFLICT DO NOTHING;
INSERT INTO public.subscriptions (user_id, plan, active_until)
  SELECT id, 'premium', NULL FROM public.profiles WHERE slug IN ('bruno-espindola', 'junior-ferreira')
  ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', active_until = NULL;
