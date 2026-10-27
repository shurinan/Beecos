-- Uma conversa por par de pessoas, busca com filtros e perfis premium em destaque.
-- Depende de 0000 (conversations), 0001 (subscriptions), 0004 (reviews, profile_skills) e 0010 (engagements).

-- Vários serviços na mesma conversa (um depois do outro): a trava de um por conversa sai antes da junção
ALTER TABLE public.engagements DROP CONSTRAINT engagements_conversation_id_key;

-- Assuntos de cada conversa: todas as publicações sobre as quais as duas pessoas já falaram.
-- É daqui que sai a lista de interessados de cada vaga.
CREATE TABLE public.conversation_posts (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, post_id)
);
REVOKE ALL ON public.conversation_posts FROM anon, authenticated;
GRANT SELECT ON public.conversation_posts TO authenticated;
GRANT ALL ON public.conversation_posts TO service_role;
ALTER TABLE public.conversation_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read conv posts" ON public.conversation_posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)));
CREATE INDEX conversation_posts_post_idx ON public.conversation_posts (post_id);

INSERT INTO public.conversation_posts (conversation_id, post_id, created_at)
SELECT id, post_id, created_at FROM public.conversations WHERE post_id IS NOT NULL;

-- 1. Junta conversas repetidas do mesmo par: fica a mais antiga, com as mensagens de todas
DO $$
DECLARE
  r record;
  keep uuid;
  latest_post uuid;
BEGIN
  FOR r IN
    SELECT least(user_a, user_b) AS a, greatest(user_a, user_b) AS b
    FROM public.conversations
    GROUP BY 1, 2
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keep FROM public.conversations
      WHERE least(user_a, user_b) = r.a AND greatest(user_a, user_b) = r.b
      ORDER BY created_at, id LIMIT 1;
    -- o assunto atual é o da conversa mais recente que tinha uma publicação
    SELECT post_id INTO latest_post FROM public.conversations
      WHERE least(user_a, user_b) = r.a AND greatest(user_a, user_b) = r.b AND post_id IS NOT NULL
      ORDER BY created_at DESC, id LIMIT 1;

    UPDATE public.messages SET conversation_id = keep
      WHERE conversation_id IN (SELECT id FROM public.conversations
        WHERE least(user_a, user_b) = r.a AND greatest(user_a, user_b) = r.b AND id <> keep);

    -- leitura: vale a mais recente de cada pessoa
    INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
      SELECT keep, cr.user_id, max(cr.last_read_at)
      FROM public.conversation_reads cr
      WHERE cr.conversation_id IN (SELECT id FROM public.conversations
        WHERE least(user_a, user_b) = r.a AND greatest(user_a, user_b) = r.b)
      GROUP BY cr.user_id
      ON CONFLICT (conversation_id, user_id)
      DO UPDATE SET last_read_at = greatest(public.conversation_reads.last_read_at, EXCLUDED.last_read_at);

    -- serviços já combinados acompanham a conversa que ficou
    UPDATE public.engagements SET conversation_id = keep
      WHERE conversation_id IN (SELECT id FROM public.conversations
        WHERE least(user_a, user_b) = r.a AND greatest(user_a, user_b) = r.b AND id <> keep);

    INSERT INTO public.conversation_posts (conversation_id, post_id, created_at)
      SELECT keep, cp.post_id, min(cp.created_at)
      FROM public.conversation_posts cp
      WHERE cp.conversation_id IN (SELECT id FROM public.conversations
        WHERE least(user_a, user_b) = r.a AND greatest(user_a, user_b) = r.b AND id <> keep)
      GROUP BY cp.post_id
      ON CONFLICT (conversation_id, post_id) DO NOTHING;

    DELETE FROM public.conversations
      WHERE least(user_a, user_b) = r.a AND greatest(user_a, user_b) = r.b AND id <> keep;

    UPDATE public.conversations SET
      post_id = coalesce(latest_post, post_id),
      last_message_at = coalesce((SELECT max(created_at) FROM public.messages WHERE conversation_id = keep), last_message_at)
    WHERE id = keep;
  END LOOP;
END $$;

CREATE UNIQUE INDEX conversations_pair_idx
  ON public.conversations (least(user_a, user_b), greatest(user_a, user_b));

-- Ninguém muda os participantes de uma conversa depois de criada
REVOKE UPDATE ON public.conversations FROM anon, authenticated;

-- Abre a conversa com alguém (ou devolve a que já existe) e passa o assunto para a publicação atual
CREATE FUNCTION public.open_conversation(_other uuid, _post uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO'; END IF;
  IF _other IS NULL OR _other = me THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other) THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;
  IF _post IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.posts WHERE id = _post AND user_id IN (me, _other)
  ) THEN
    _post := NULL;
  END IF;

  SELECT id INTO cid FROM public.conversations
    WHERE least(user_a, user_b) = least(me, _other) AND greatest(user_a, user_b) = greatest(me, _other);
  IF FOUND THEN
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
REVOKE ALL ON FUNCTION public.open_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid, uuid) TO authenticated;

-- 2. Mesma conversa pode ter vários serviços, um depois do outro (só um em aberto por vez)
CREATE INDEX engagements_conversation_idx ON public.engagements (conversation_id, created_at DESC);
CREATE UNIQUE INDEX engagements_one_open_idx ON public.engagements (conversation_id)
  WHERE status IN ('proposed', 'accepted');

DROP FUNCTION public.choose_provider(uuid);
CREATE FUNCTION public.choose_provider(_conversation uuid, _post uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  c public.conversations;
  p public.posts;
  other uuid;
  v_client uuid;
  v_provider uuid;
  eid uuid;
  pname text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO'; END IF;
  SELECT * INTO c FROM public.conversations WHERE id = _conversation;
  IF NOT FOUND OR me NOT IN (c.user_a, c.user_b) THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;
  -- a publicação vem de quem chama (lista de interessados); sem ela vale o assunto atual da conversa
  IF coalesce(_post, c.post_id) IS NULL THEN RAISE EXCEPTION 'SEM_PUBLICACAO'; END IF;
  SELECT * INTO p FROM public.posts WHERE id = coalesce(_post, c.post_id);
  IF NOT FOUND OR p.user_id NOT IN (c.user_a, c.user_b) THEN RAISE EXCEPTION 'CONVERSA_INVALIDA'; END IF;
  IF p.id IS DISTINCT FROM c.post_id AND NOT EXISTS (
    SELECT 1 FROM public.conversation_posts cp WHERE cp.conversation_id = _conversation AND cp.post_id = p.id
  ) THEN
    RAISE EXCEPTION 'CONVERSA_INVALIDA';
  END IF;

  other := CASE WHEN c.user_a = p.user_id THEN c.user_b ELSE c.user_a END;
  IF p.kind = 'job' THEN v_client := p.user_id; v_provider := other;
  ELSE v_client := other; v_provider := p.user_id; END IF;
  IF me <> v_client THEN RAISE EXCEPTION 'SO_QUEM_CONTRATA_ESCOLHE'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = _conversation AND m.sender_id = v_provider AND m.kind = 'user') THEN
    RAISE EXCEPTION 'AINDA_SEM_RESPOSTA';
  END IF;

  -- um serviço em aberto por conversa; os concluídos e cancelados ficam no histórico
  PERFORM 1 FROM public.conversations WHERE id = _conversation FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.engagements WHERE conversation_id = _conversation AND status IN ('proposed', 'accepted')) THEN
    RAISE EXCEPTION 'JA_ESCOLHIDO';
  END IF;

  IF p.kind = 'job' AND (
    SELECT count(*) FROM public.engagements e
    WHERE e.post_id = p.id AND e.status IN ('proposed', 'accepted', 'completed')
  ) >= p.vacancies THEN
    RAISE EXCEPTION 'VAGAS_PREENCHIDAS';
  END IF;

  INSERT INTO public.engagements (post_id, conversation_id, client_id, provider_id)
  VALUES (p.id, _conversation, v_client, v_provider) RETURNING id INTO eid;
  -- o cartão do serviço no chat mostra a publicação escolhida
  UPDATE public.conversations SET post_id = p.id WHERE id = _conversation AND post_id IS DISTINCT FROM p.id;

  SELECT full_name INTO pname FROM public.profiles WHERE id = v_provider;
  PERFORM public._engagement_note(_conversation,
    format('%s foi escolhido(a) para o serviço "%s". Aguardando a confirmação.', coalesce(nullif(pname, ''), 'Prestador'), left(p.title, 80)));
  RETURN eid;
END $$;

REVOKE ALL ON FUNCTION public.choose_provider(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_provider(uuid, uuid) TO authenticated;

-- 3. Perfis premium: só a lista de quem tem plano ativo (sem datas nem detalhes) para o selo e o destaque
CREATE VIEW public.premium_users AS
SELECT user_id FROM public.subscriptions
WHERE plan = 'premium' AND (active_until IS NULL OR active_until > now());
REVOKE ALL ON public.premium_users FROM anon, authenticated;
GRANT SELECT ON public.premium_users TO anon, authenticated;
GRANT ALL ON public.premium_users TO service_role;

-- 4. Preço como número, para filtrar. "R$ 1.200", "350,50/dia" e "a combinar" (sem número)
CREATE FUNCTION public.parse_price(_t text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN m IS NULL THEN NULL
    ELSE replace(replace(m, '.', ''), ',', '.')::numeric
  END
  FROM (SELECT substring(coalesce(_t, '') from '[0-9]+(?:\.[0-9]{3})*(?:,[0-9]+)?') AS m) s
$$;
ALTER TABLE public.posts ADD COLUMN price_value numeric GENERATED ALWAYS AS (public.parse_price(price)) STORED;
CREATE INDEX posts_search_idx ON public.posts (kind, created_at DESC);

-- 5. Busca: devolve só os ids na ordem certa (premium primeiro, depois os mais novos)
CREATE FUNCTION public.search_post_ids(
  _kind text,
  _city text DEFAULT '',
  _q text DEFAULT '',
  _min_price numeric DEFAULT NULL,
  _max_price numeric DEFAULT NULL,
  _min_rating numeric DEFAULT NULL,
  _only_premium boolean DEFAULT false,
  _limit integer DEFAULT 50
) RETURNS TABLE (id uuid, premium boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (
    SELECT '%' || replace(replace(replace(btrim(coalesce(_city, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS city,
           '%' || replace(replace(replace(btrim(coalesce(_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS q
  )
  SELECT p.id, (pr.user_id IS NOT NULL) AS premium
  FROM public.posts p
  CROSS JOIN f
  LEFT JOIN public.premium_users pr ON pr.user_id = p.user_id
  LEFT JOIN LATERAL (
    SELECT avg(rv.rating) AS avg_rating FROM public.reviews rv WHERE rv.reviewee_id = p.user_id
  ) r ON true
  WHERE p.kind = _kind
    AND (btrim(coalesce(_city, '')) = '' OR p.city ILIKE f.city)
    AND (btrim(coalesce(_q, '')) = '' OR p.title ILIKE f.q OR p.description ILIKE f.q
         OR EXISTS (SELECT 1 FROM public.profile_skills s WHERE s.user_id = p.user_id AND s.skill ILIKE f.q))
    AND (_min_price IS NULL OR p.price_value >= _min_price)
    AND (_max_price IS NULL OR p.price_value <= _max_price)
    AND (_min_rating IS NULL OR r.avg_rating >= _min_rating)
    AND (NOT coalesce(_only_premium, false) OR pr.user_id IS NOT NULL)
  ORDER BY (pr.user_id IS NOT NULL) DESC, p.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 100)
$$;
REVOKE ALL ON FUNCTION public.search_post_ids(text, text, text, numeric, numeric, numeric, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_post_ids(text, text, text, numeric, numeric, numeric, boolean, integer) TO anon, authenticated;
