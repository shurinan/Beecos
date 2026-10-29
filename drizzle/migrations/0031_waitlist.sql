-- Vaga cheia (5 negociações abertas):
--  * dono no plano Grátis: quem chega depois vê "Essa oportunidade foi preenchida" e o dono não troca ninguém;
--  * dono Premium: quem chega entra na fila de espera; o dono pode encerrar uma negociação e a vez passa
--    para o primeiro da fila. Ninguém vê quantos estão negociando nem quantos esperam.
-- Depende de 0016 (negociações), 0015 (notifications) e 0030 (vigilância).

ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('new_job', 'queue_turn'));

CREATE TABLE public.post_waitlist (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  -- sem FK para profiles de propósito: uma tabela ligando posts e profiles cria um caminho extra e o PostgREST
  -- passa a recusar o embed posts → profiles por ambiguidade (o feed ficava vazio). A limpeza é pelo gatilho abaixo.
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_waitlist_order ON public.post_waitlist (post_id, created_at);
REVOKE ALL ON public.post_waitlist FROM anon, authenticated;
GRANT SELECT ON public.post_waitlist TO authenticated;
GRANT ALL ON public.post_waitlist TO service_role;
ALTER TABLE public.post_waitlist ENABLE ROW LEVEL SECURITY;
-- cada pessoa só enxerga o próprio lugar na fila (nem o dono da vaga lê a lista)
CREATE POLICY "own waitlist read" ON public.post_waitlist FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Chamada depois que open_conversation recusa por vaga cheia. Devolve 'waiting' ou 'full'.
CREATE FUNCTION public.join_waitlist(_post uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); p public.posts;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
  SELECT * INTO p FROM public.posts WHERE id = _post AND kind = 'job' AND hidden_at IS NULL;
  IF NOT FOUND OR p.user_id = me THEN RAISE EXCEPTION 'NEGOCIACAO_INVALIDA'; END IF;
  IF public.open_negotiations(_post) < public.max_open_negotiations() THEN RAISE EXCEPTION 'VAGA_ABERTA'; END IF;
  IF NOT public.is_premium(p.user_id) THEN RETURN 'full'; END IF;
  IF public.is_on_hold(me) OR public.is_on_hold(p.user_id) THEN
    RAISE EXCEPTION 'CONTA_EM_ANALISE' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.post_waitlist (post_id, user_id) VALUES (_post, me) ON CONFLICT DO NOTHING;
  RETURN 'waiting';
END $$;
REVOKE ALL ON FUNCTION public.join_waitlist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_waitlist(uuid) TO authenticated;

-- Interna: enquanto houver vaga livre e gente na fila, abre a conversa com o primeiro e avisa.
CREATE FUNCTION public._promote_waitlist(_post uuid) RETURNS void
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
        ON CONFLICT (conversation_id, post_id) DO UPDATE SET closed_at = NULL, closed_by = NULL;
      INSERT INTO public.notifications (user_id, kind, post_id, actor_id, title, body)
      VALUES (w, 'queue_turn', _post, p.user_id, 'Chegou a sua vez!',
              format('Abriu uma vaga na negociação de "%s". Já pode conversar.', left(p.title, 80)))
      ON CONFLICT (user_id, post_id, kind) DO NOTHING;
      PERFORM public._engagement_note(cid, format('Chegou a vez de conversar sobre "%s".', left(p.title, 80)));
    EXCEPTION WHEN OTHERS THEN
      EXIT; -- qualquer trava (vigilância, limite): a pessoa continua na fila e tentamos de novo na próxima vaga livre
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._promote_waitlist(uuid) FROM PUBLIC, anon, authenticated;

-- Só o plano Premium troca quem negocia; ao encerrar, a vez passa para a fila.
CREATE OR REPLACE FUNCTION public.close_negotiation(_conversation uuid, _post uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  p public.posts;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = _post FOR UPDATE;
  IF NOT FOUND OR p.user_id IS DISTINCT FROM me OR p.kind <> 'job' THEN RAISE EXCEPTION 'NEGOCIACAO_INVALIDA'; END IF;
  IF NOT public.is_premium(me) THEN RAISE EXCEPTION 'SO_PREMIUM_TROCA'; END IF;
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
    PERFORM public._promote_waitlist(_post);
  END IF;
END $$;

CREATE FUNCTION public.cleanup_waitlist_on_profile_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.post_waitlist WHERE user_id = OLD.id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.cleanup_waitlist_on_profile_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_waitlist_cleanup AFTER DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.cleanup_waitlist_on_profile_delete();
