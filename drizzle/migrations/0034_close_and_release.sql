-- Dois jeitos de encerrar uma negociação:
--  * "Encerrar" (todos os planos): a conversa continua e o lugar NÃO é liberado.
--  * "Encerrar e receber novo contato" (Premium): o lugar é liberado; entra o primeiro da fila ou,
--    sem fila, a vaga volta a aceitar um novo interessado.
-- Depende de 0016, 0031 e 0033.

ALTER TABLE public.conversation_posts ADD COLUMN released boolean NOT NULL DEFAULT false;
-- o que o Premium já tinha encerrado liberava o lugar: continua assim
UPDATE public.conversation_posts cp SET released = true
  FROM public.posts p
  WHERE p.id = cp.post_id AND cp.closed_at IS NOT NULL AND public.is_premium(p.user_id);

-- conta tudo que ocupa lugar: aberta, ou encerrada sem liberar
CREATE OR REPLACE FUNCTION public.open_negotiations(_post uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.conversation_posts cp
  WHERE cp.post_id = _post
    AND (cp.closed_at IS NULL OR NOT cp.released)
    AND NOT EXISTS (
      SELECT 1 FROM public.engagements e
      WHERE e.conversation_id = cp.conversation_id AND e.post_id = cp.post_id
        AND e.status IN ('proposed', 'accepted', 'completed'))
$$;

DROP FUNCTION public.close_negotiation(uuid, uuid);
CREATE FUNCTION public.close_negotiation(_conversation uuid, _post uuid, _release boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p public.posts;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post FOR UPDATE;
  IF NOT FOUND OR p.user_id IS DISTINCT FROM me OR p.kind <> 'job' THEN RAISE EXCEPTION 'NEGOCIACAO_INVALIDA'; END IF;
  IF coalesce(_release, false) AND NOT public.is_premium(me) THEN RAISE EXCEPTION 'SO_PREMIUM_TROCA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_posts WHERE conversation_id = _conversation AND post_id = _post) THEN
    RAISE EXCEPTION 'NEGOCIACAO_INVALIDA';
  END IF;
  IF EXISTS (SELECT 1 FROM public.engagements WHERE conversation_id = _conversation AND post_id = _post
             AND status IN ('proposed', 'accepted', 'completed')) THEN
    RAISE EXCEPTION 'SERVICO_EM_ANDAMENTO';
  END IF;
  -- encerrar uma já encerrada sem liberar, agora liberando, também vale
  UPDATE public.conversation_posts
     SET closed_at = coalesce(closed_at, now()), closed_by = me, released = released OR coalesce(_release, false)
   WHERE conversation_id = _conversation AND post_id = _post
     AND (closed_at IS NULL OR (coalesce(_release, false) AND NOT released));
  IF FOUND THEN
    PERFORM public._engagement_note(_conversation,
      format('A negociação da vaga "%s" foi encerrada por quem publicou.', left(p.title, 80)));
    IF coalesce(_release, false) THEN PERFORM public._promote_waitlist(_post); END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.close_negotiation(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_negotiation(uuid, uuid, boolean) TO authenticated;

-- Reabrir: se o lugar foi liberado, precisa haver lugar de novo; se não foi, ele nunca deixou de contar.
CREATE OR REPLACE FUNCTION public.reopen_negotiation(_conversation uuid, _post uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p public.posts;
  was_released boolean;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post FOR UPDATE;
  IF NOT FOUND OR p.user_id IS DISTINCT FROM me OR p.kind <> 'job' THEN RAISE EXCEPTION 'NEGOCIACAO_INVALIDA'; END IF;
  SELECT released INTO was_released FROM public.conversation_posts
    WHERE conversation_id = _conversation AND post_id = _post AND closed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NEGOCIACAO_INVALIDA'; END IF;
  IF was_released AND public.open_negotiations(_post) >= public.max_open_negotiations() THEN
    RAISE EXCEPTION 'NEGOCIACOES_CHEIAS';
  END IF;
  UPDATE public.conversation_posts SET closed_at = NULL, closed_by = NULL, released = false
    WHERE conversation_id = _conversation AND post_id = _post;
  PERFORM public._engagement_note(_conversation,
    format('A negociação da vaga "%s" foi reaberta.', left(p.title, 80)));
END $$;

-- Quem entra pela fila numa conversa que já existia volta como negociação aberta
CREATE OR REPLACE FUNCTION public._promote_waitlist(_post uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.posts; w uuid; cid uuid;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post;
  IF NOT FOUND OR p.hidden_at IS NOT NULL OR NOT public.is_premium(p.user_id) THEN RETURN; END IF;
  WHILE public.open_negotiations(_post) < public.max_open_negotiations() LOOP
    SELECT user_id INTO w FROM public.post_waitlist WHERE post_id = _post ORDER BY created_at LIMIT 1;
    EXIT WHEN NOT FOUND;
    BEGIN
      DELETE FROM public.post_waitlist WHERE post_id = _post AND user_id = w;
      SELECT id INTO cid FROM public.conversations
        WHERE least(user_a, user_b) = least(p.user_id, w) AND greatest(user_a, user_b) = greatest(p.user_id, w);
      IF cid IS NULL THEN
        INSERT INTO public.conversations (user_a, user_b, post_id) VALUES (p.user_id, w, _post) RETURNING id INTO cid;
      ELSE
        UPDATE public.conversations SET post_id = _post WHERE id = cid;
      END IF;
      INSERT INTO public.conversation_posts (conversation_id, post_id) VALUES (cid, _post)
        ON CONFLICT (conversation_id, post_id) DO UPDATE SET closed_at = NULL, closed_by = NULL, released = false;
      INSERT INTO public.notifications (user_id, kind, post_id, actor_id, title, body)
      VALUES (w, 'queue_turn', _post, p.user_id, 'Chegou a sua vez!',
              format('Abriu uma vaga na negociação de "%s". Já pode conversar.', left(p.title, 80)))
      ON CONFLICT (user_id, post_id, kind) DO NOTHING;
      PERFORM public._engagement_note(cid, format('Chegou a vez de conversar sobre "%s".', left(p.title, 80)));
    EXCEPTION WHEN OTHERS THEN
      EXIT;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._promote_waitlist(uuid) FROM PUBLIC, anon, authenticated;
