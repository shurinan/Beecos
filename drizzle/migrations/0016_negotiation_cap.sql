-- Até 5 negociações abertas por vaga. O dono da vaga pode encerrar uma (quem não segue) para abrir a próxima.
-- Negociação = interesse registrado em conversation_posts. Quem já foi escolhido (ou concluiu) não ocupa vaga de negociação.
-- Depende de 0010 (engagements) e 0011 (conversation_posts, open_conversation).

ALTER TABLE public.conversation_posts
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE FUNCTION public.max_open_negotiations() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 5 $$;

-- Quantas negociações abertas a vaga tem hoje (sem contar as encerradas nem quem já foi escolhido).
CREATE FUNCTION public.open_negotiations(_post uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.conversation_posts cp
  WHERE cp.post_id = _post AND cp.closed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.engagements e
      WHERE e.conversation_id = cp.conversation_id AND e.post_id = cp.post_id
        AND e.status IN ('proposed', 'accepted', 'completed'))
$$;
REVOKE ALL ON FUNCTION public.open_negotiations(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.open_conversation(_other uuid, _post uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  cid uuid;
  p public.posts;
  has_row boolean := false;
  was_closed timestamptz;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO'; END IF;
  IF _other IS NULL OR _other = me THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other) THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;
  IF _post IS NOT NULL THEN
    -- trava a vaga: duas pessoas entrando ao mesmo tempo não passam do limite
    SELECT * INTO p FROM public.posts WHERE id = _post AND user_id IN (me, _other) FOR UPDATE;
    IF NOT FOUND THEN _post := NULL; END IF;
  END IF;

  SELECT id INTO cid FROM public.conversations
    WHERE least(user_a, user_b) = least(me, _other) AND greatest(user_a, user_b) = greatest(me, _other);

  IF _post IS NOT NULL AND p.kind = 'job' THEN
    IF cid IS NOT NULL THEN
      SELECT closed_at INTO was_closed FROM public.conversation_posts WHERE conversation_id = cid AND post_id = _post;
      has_row := FOUND;
    END IF;
    IF has_row AND was_closed IS NOT NULL THEN
      IF me <> p.user_id THEN RAISE EXCEPTION 'NEGOCIACAO_ENCERRADA'; END IF;
      IF public.open_negotiations(_post) >= public.max_open_negotiations() THEN RAISE EXCEPTION 'NEGOCIACOES_CHEIAS'; END IF;
      UPDATE public.conversation_posts SET closed_at = NULL, closed_by = NULL
        WHERE conversation_id = cid AND post_id = _post;
    ELSIF NOT has_row THEN
      IF public.open_negotiations(_post) >= public.max_open_negotiations() THEN RAISE EXCEPTION 'NEGOCIACOES_CHEIAS'; END IF;
    END IF;
  END IF;

  IF cid IS NOT NULL THEN
    IF _post IS NOT NULL THEN
      UPDATE public.conversations SET post_id = _post WHERE id = cid AND post_id IS DISTINCT FROM _post;
      INSERT INTO public.conversation_posts (conversation_id, post_id) VALUES (cid, _post) ON CONFLICT DO NOTHING;
    END IF;
    RETURN cid;
  END IF;

  -- o limite do plano grátis vale só para conversas novas (o gatilho de 0001 confere)
  INSERT INTO public.conversations (user_a, user_b, post_id) VALUES (me, _other, _post) RETURNING id INTO cid;
  IF _post IS NOT NULL THEN
    INSERT INTO public.conversation_posts (conversation_id, post_id) VALUES (cid, _post) ON CONFLICT DO NOTHING;
  END IF;
  RETURN cid;
END $$;

-- Quem publica a vaga encerra a negociação com alguém (a conversa continua; só aquela vaga deixa de contar).
CREATE FUNCTION public.close_negotiation(_conversation uuid, _post uuid) RETURNS void
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
  END IF;
END $$;

CREATE FUNCTION public.reopen_negotiation(_conversation uuid, _post uuid) RETURNS void
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
  IF public.open_negotiations(_post) >= public.max_open_negotiations() THEN RAISE EXCEPTION 'NEGOCIACOES_CHEIAS'; END IF;
  UPDATE public.conversation_posts SET closed_at = NULL, closed_by = NULL
    WHERE conversation_id = _conversation AND post_id = _post;
  PERFORM public._engagement_note(_conversation,
    format('A negociação da vaga "%s" foi reaberta.', left(p.title, 80)));
END $$;

REVOKE ALL ON FUNCTION public.close_negotiation(uuid, uuid), public.reopen_negotiation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_negotiation(uuid, uuid), public.reopen_negotiation(uuid, uuid) TO authenticated;

-- Escolher alguém cuja negociação foi encerrada não vale (o dono reabre antes, se mudar de ideia).
CREATE FUNCTION public.guard_engagement_negotiation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.post_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conversation_posts cp
    WHERE cp.conversation_id = NEW.conversation_id AND cp.post_id = NEW.post_id AND cp.closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'NEGOCIACAO_ENCERRADA' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER engagements_negotiation_guard BEFORE INSERT ON public.engagements
  FOR EACH ROW EXECUTE FUNCTION public.guard_engagement_negotiation();
REVOKE EXECUTE ON FUNCTION public.guard_engagement_negotiation() FROM PUBLIC, anon, authenticated;
