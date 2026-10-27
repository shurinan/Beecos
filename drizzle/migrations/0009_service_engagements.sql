-- Associação de serviço: quem contrata ESCOLHE o prestador, o prestador ACEITA, e qualquer um
-- dos dois marca como CONCLUÍDO. Só depois de concluído as duas pessoas podem se avaliar.
-- Também: vagas por publicação, mensagens de sistema no chat e telefones visíveis a quem conversa.
-- Depende de 0000, 0004 (reviews/can_review), 0006 (contact_phones) e 0008 (moderação).

-- 1. Vagas por publicação (quantas pessoas a vaga precisa)
ALTER TABLE public.posts
  ADD COLUMN vacancies smallint NOT NULL DEFAULT 1 CHECK (vacancies BETWEEN 1 AND 20);

-- 2. Mensagens de sistema ("fulano foi escolhido"): só as funções abaixo criam; o app só cria 'user'
ALTER TABLE public.messages
  ADD COLUMN kind text NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'system'));
DROP POLICY "participants send msgs" ON public.messages;
CREATE POLICY "participants send msgs" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND kind = 'user' AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)));

-- 3. Serviços (uma associação por conversa)
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL, -- apagar a publicação não apaga o histórico
  conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- quem contrata
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- quem presta o serviço
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'completed', 'cancelled')),
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  CHECK (client_id <> provider_id)
);
-- Só leitura direto; toda mudança passa pelas funções (que conferem quem pode fazer o quê)
GRANT SELECT ON public.engagements TO authenticated;
GRANT ALL ON public.engagements TO service_role;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read engagements" ON public.engagements FOR SELECT TO authenticated
  USING (auth.uid() IN (client_id, provider_id));
CREATE INDEX engagements_post_idx ON public.engagements (post_id);

CREATE TRIGGER engagements_touch BEFORE UPDATE ON public.engagements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Quantas vagas já estão ocupadas (escolhido, aceito ou concluído). Público: só números.
CREATE VIEW public.post_stats AS
SELECT p.id AS post_id, p.vacancies,
       (count(e.id) FILTER (WHERE e.status IN ('proposed', 'accepted', 'completed')))::int AS taken
FROM public.posts p
LEFT JOIN public.engagements e ON e.post_id = p.id
GROUP BY p.id;
GRANT SELECT ON public.post_stats TO anon, authenticated;
GRANT ALL ON public.post_stats TO service_role;

-- Aviso no chat (aparece no histórico e conta como mensagem não lida para a outra pessoa)
CREATE FUNCTION public._engagement_note(_conversation uuid, _text text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.messages (conversation_id, sender_id, content, kind)
  VALUES (_conversation, auth.uid(), left(_text, 500), 'system')
$$;
REVOKE ALL ON FUNCTION public._engagement_note(uuid, text) FROM PUBLIC;

-- Quem contrata escolhe quem presta o serviço.
--  vaga ('job'): quem publicou contrata, o interessado presta.
--  oferta ('available'): quem publicou presta, o interessado contrata.
CREATE FUNCTION public.choose_provider(_conversation uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  c public.conversations;
  p public.posts;
  other uuid;
  v_client uuid;
  v_provider uuid;
  ex public.engagements;
  eid uuid;
  pname text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO'; END IF;
  SELECT * INTO c FROM public.conversations WHERE id = _conversation;
  IF NOT FOUND OR me NOT IN (c.user_a, c.user_b) THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;
  IF c.post_id IS NULL THEN RAISE EXCEPTION 'SEM_PUBLICACAO'; END IF;
  SELECT * INTO p FROM public.posts WHERE id = c.post_id;
  IF NOT FOUND OR p.user_id NOT IN (c.user_a, c.user_b) THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;

  -- o interessado é o participante que não publicou
  other := CASE WHEN c.user_a = p.user_id THEN c.user_b ELSE c.user_a END;
  IF p.kind = 'job' THEN v_client := p.user_id; v_provider := other;
  ELSE v_client := other; v_provider := p.user_id; END IF;
  IF me <> v_client THEN RAISE EXCEPTION 'SO_QUEM_CONTRATA_ESCOLHE'; END IF;

  -- só é possível escolher quem já respondeu ao menos uma vez (a conversa precisa ter dois lados)
  IF NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = _conversation AND m.sender_id = v_provider AND m.kind = 'user') THEN
    RAISE EXCEPTION 'AINDA_SEM_RESPOSTA';
  END IF;

  IF p.kind = 'job' AND (
    SELECT count(*) FROM public.engagements e
    WHERE e.post_id = p.id AND e.conversation_id <> _conversation AND e.status IN ('proposed', 'accepted', 'completed')
  ) >= p.vacancies THEN
    RAISE EXCEPTION 'VAGAS_PREENCHIDAS';
  END IF;

  SELECT * INTO ex FROM public.engagements WHERE conversation_id = _conversation FOR UPDATE;
  IF FOUND THEN
    IF ex.status <> 'cancelled' THEN RAISE EXCEPTION 'JA_ESCOLHIDO'; END IF;
    UPDATE public.engagements
      SET status = 'proposed', cancelled_by = NULL, accepted_at = NULL, completed_at = NULL, post_id = p.id,
          client_id = v_client, provider_id = v_provider
      WHERE id = ex.id RETURNING id INTO eid;
  ELSE
    INSERT INTO public.engagements (post_id, conversation_id, client_id, provider_id)
    VALUES (p.id, _conversation, v_client, v_provider) RETURNING id INTO eid;
  END IF;

  SELECT full_name INTO pname FROM public.profiles WHERE id = v_provider;
  PERFORM public._engagement_note(_conversation,
    format('%s foi escolhido(a) para o serviço "%s". Aguardando a confirmação.', coalesce(nullif(pname, ''), 'Prestador'), left(p.title, 80)));
  RETURN eid;
END $$;

-- O prestador aceita ou recusa
CREATE FUNCTION public.respond_engagement(_id uuid, _accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  e public.engagements;
  pname text;
BEGIN
  SELECT * INTO e FROM public.engagements WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR e.provider_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'SERVICO_INVALIDO'; END IF;
  IF e.status <> 'proposed' THEN RAISE EXCEPTION 'STATUS_INVALIDO'; END IF;
  SELECT coalesce(nullif(full_name, ''), 'O prestador') INTO pname FROM public.profiles WHERE id = me;
  IF _accept THEN
    UPDATE public.engagements SET status = 'accepted', accepted_at = now() WHERE id = _id;
    PERFORM public._engagement_note(e.conversation_id, format('%s aceitou o serviço. Combinado!', pname));
  ELSE
    UPDATE public.engagements SET status = 'cancelled', cancelled_by = me WHERE id = _id;
    PERFORM public._engagement_note(e.conversation_id, format('%s recusou o serviço.', pname));
  END IF;
END $$;

-- Qualquer um dos dois marca como concluído (depois de aceito)
CREATE FUNCTION public.complete_engagement(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  e public.engagements;
BEGIN
  SELECT * INTO e FROM public.engagements WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR me NOT IN (e.client_id, e.provider_id) THEN RAISE EXCEPTION 'SERVICO_INVALIDO'; END IF;
  IF e.status <> 'accepted' THEN RAISE EXCEPTION 'STATUS_INVALIDO'; END IF;
  UPDATE public.engagements SET status = 'completed', completed_at = now() WHERE id = _id;
  PERFORM public._engagement_note(e.conversation_id, 'Serviço concluído. Agora vocês podem se avaliar.');
END $$;

-- Cancelar (retirar a escolha ou desistir de um serviço em andamento)
CREATE FUNCTION public.cancel_engagement(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  e public.engagements;
BEGIN
  SELECT * INTO e FROM public.engagements WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR me NOT IN (e.client_id, e.provider_id) THEN RAISE EXCEPTION 'SERVICO_INVALIDO'; END IF;
  IF e.status NOT IN ('proposed', 'accepted') THEN RAISE EXCEPTION 'STATUS_INVALIDO'; END IF;
  UPDATE public.engagements SET status = 'cancelled', cancelled_by = me WHERE id = _id;
  PERFORM public._engagement_note(e.conversation_id, 'Serviço cancelado.');
END $$;

REVOKE ALL ON FUNCTION public.choose_provider(uuid), public.respond_engagement(uuid, boolean),
  public.complete_engagement(uuid), public.cancel_engagement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.choose_provider(uuid), public.respond_engagement(uuid, boolean),
  public.complete_engagement(uuid), public.cancel_engagement(uuid) TO authenticated;

-- 4. Avaliação só depois de um serviço concluído entre as duas pessoas (nos dois sentidos)
CREATE OR REPLACE FUNCTION public.can_review(_reviewer uuid, _reviewee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _reviewer <> _reviewee AND EXISTS (
    SELECT 1 FROM public.engagements e
    WHERE e.status = 'completed'
      AND ((e.client_id = _reviewer AND e.provider_id = _reviewee)
        OR (e.client_id = _reviewee AND e.provider_id = _reviewer))
  )
$$;

-- 5. Telefones visíveis a quem conversa com a pessoa (ela escolhe, telefone a telefone)
ALTER TABLE public.contact_phones ADD COLUMN shared boolean NOT NULL DEFAULT false;

-- "Conversa de verdade": as duas pessoas já escreveram na mesma conversa
CREATE FUNCTION public.in_active_conversation(_a uuid, _b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE ((c.user_a = _a AND c.user_b = _b) OR (c.user_a = _b AND c.user_b = _a))
      AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.sender_id = _a AND m.kind = 'user')
      AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.sender_id = _b AND m.kind = 'user')
  )
$$;
REVOKE ALL ON FUNCTION public.in_active_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.in_active_conversation(uuid, uuid) TO authenticated;

CREATE POLICY "partners read shared phones" ON public.contact_phones FOR SELECT TO authenticated
  USING (shared AND user_id <> auth.uid() AND public.in_active_conversation(auth.uid(), user_id));
