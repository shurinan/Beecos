CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'premium',
  active_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription read" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND plan = 'premium' AND (active_until IS NULL OR active_until > now()))
$$;

CREATE OR REPLACE FUNCTION public.enforce_job_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'job' AND NOT public.is_premium(NEW.user_id) THEN
    IF (SELECT count(*) FROM public.posts WHERE user_id = NEW.user_id AND kind = 'job'
        AND created_at >= date_trunc('month', now())) >= 2 THEN
      RAISE EXCEPTION 'LIMITE_VAGAS';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posts_job_limit BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.enforce_job_limit();

CREATE OR REPLACE FUNCTION public.enforce_chat_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_premium(NEW.user_a) THEN
    IF (SELECT count(*) FROM public.conversations WHERE user_a = NEW.user_a
        AND created_at >= date_trunc('month', now())) >= 5 THEN
      RAISE EXCEPTION 'LIMITE_CHATS';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conversations_chat_limit BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_limit();