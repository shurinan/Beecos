-- Encerrar negociação vale para todos os planos. Só no Premium o lugar fica livre e o próximo da fila entra.
-- No Grátis, a negociação encerrada continua contando no limite de 5: a vaga segue "preenchida" para quem chega.
-- Depende de 0016 e 0031.

CREATE OR REPLACE FUNCTION public.open_negotiations(_post uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.conversation_posts cp
  JOIN public.posts p ON p.id = cp.post_id
  WHERE cp.post_id = _post
    AND (cp.closed_at IS NULL OR NOT public.is_premium(p.user_id))
    AND NOT EXISTS (
      SELECT 1 FROM public.engagements e
      WHERE e.conversation_id = cp.conversation_id AND e.post_id = cp.post_id
        AND e.status IN ('proposed', 'accepted', 'completed'))
$$;

CREATE OR REPLACE FUNCTION public.close_negotiation(_conversation uuid, _post uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p public.posts;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post FOR UPDATE;
  IF NOT FOUND OR p.user_id IS DISTINCT FROM me OR p.kind <> 'job' THEN RAISE EXCEPTION 'NEGOCIACAO_INVALIDA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_posts WHERE conversation_id = _conversation AND post_id = _post) THEN
    RAISE EXCEPTION 'NEGOCIACAO_INVALIDA';
  END IF;
  IF EXISTS (SELECT 1 FROM public.engagements WHERE conversation_id = _conversation AND post_id = _post
             AND status IN ('proposed', 'accepted', 'completed')) THEN
    RAISE EXCEPTION 'SERVICO_EM_ANDAMENTO';
  END IF;
  UPDATE public.conversation_posts SET closed_at = now(), closed_by = me
    WHERE conversation_id = _conversation AND post_id = _post AND closed_at IS NULL;
  IF FOUND THEN
    PERFORM public._engagement_note(_conversation,
      format('A negociação da vaga "%s" foi encerrada por quem publicou.', left(p.title, 80)));
    PERFORM public._promote_waitlist(_post); -- só faz algo se o dono for Premium
  END IF;
END $$;

-- Reabrir: no Grátis a negociação nunca deixou de contar, então não precisa de lugar livre.
CREATE OR REPLACE FUNCTION public.reopen_negotiation(_conversation uuid, _post uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p public.posts;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post FOR UPDATE;
  IF NOT FOUND OR p.user_id IS DISTINCT FROM me OR p.kind <> 'job' THEN RAISE EXCEPTION 'NEGOCIACAO_INVALIDA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_posts WHERE conversation_id = _conversation AND post_id = _post AND closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'NEGOCIACAO_INVALIDA';
  END IF;
  IF public.is_premium(me) AND public.open_negotiations(_post) >= public.max_open_negotiations() THEN
    RAISE EXCEPTION 'NEGOCIACOES_CHEIAS';
  END IF;
  UPDATE public.conversation_posts SET closed_at = NULL, closed_by = NULL
    WHERE conversation_id = _conversation AND post_id = _post;
  PERFORM public._engagement_note(_conversation,
    format('A negociação da vaga "%s" foi reaberta.', left(p.title, 80)));
END $$;
