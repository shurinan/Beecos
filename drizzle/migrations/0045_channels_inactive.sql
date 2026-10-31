-- Canal sem dono Premium fica inativo: some para os outros e não aceita vagas novas. Volta sozinho ao renovar.
DROP POLICY "channels read" ON public.channels;
CREATE POLICY "channels read" ON public.channels FOR SELECT TO authenticated
  USING ((hidden_at IS NULL AND public.is_premium(owner_id)) OR owner_id = auth.uid() OR public.is_moderator());

DROP POLICY "follows own insert" ON public.channel_follows;
CREATE POLICY "follows own insert" ON public.channel_follows FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.hidden_at IS NULL AND public.is_premium(c.owner_id)));

CREATE OR REPLACE FUNCTION public.channel_overview(_ids uuid[])
RETURNS TABLE (channel_id uuid, followers integer, open_jobs integer, following boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,
         (SELECT count(*)::int FROM public.channel_follows f WHERE f.channel_id = c.id),
         (SELECT count(*)::int FROM public.posts p
           WHERE p.channel_id = c.id AND p.kind = 'job' AND p.hidden_at IS NULL AND p.closed_at IS NULL
             AND (p.expires_at IS NULL OR p.expires_at > now())),
         EXISTS (SELECT 1 FROM public.channel_follows f WHERE f.channel_id = c.id AND f.user_id = auth.uid())
  FROM public.channels c
  WHERE c.id = ANY (_ids[1:100])
    AND ((c.hidden_at IS NULL AND public.is_premium(c.owner_id)) OR c.owner_id = auth.uid() OR public.is_moderator())
$$;

-- só publica em canal ativo (dono Premium)
CREATE OR REPLACE FUNCTION public.post_deadline_and_channel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'job' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.expires_at := least(greatest(coalesce(NEW.expires_at, now() + interval '30 days'), now() + interval '1 hour'),
                              now() + interval '30 days');
    ELSE
      NEW.expires_at := CASE WHEN OLD.expires_at IS NULL THEN OLD.expires_at
                             ELSE least(coalesce(NEW.expires_at, OLD.expires_at), OLD.created_at + interval '30 days') END;
    END IF;
  ELSE
    NEW.expires_at := NULL; NEW.channel_id := NULL; NEW.closed_at := NULL;
  END IF;
  IF NEW.channel_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.channel_id IS DISTINCT FROM OLD.channel_id)
     AND NOT EXISTS (SELECT 1 FROM public.channels c
                     WHERE c.id = NEW.channel_id AND c.owner_id = NEW.user_id AND c.hidden_at IS NULL
                       AND public.is_premium(c.owner_id)) THEN
    RAISE EXCEPTION 'CANAL_INVALIDO' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
