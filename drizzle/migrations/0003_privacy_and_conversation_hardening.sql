-- 1. Telefone deixa de ser público ------------------------------------------
-- profiles é legível por qualquer pessoa (inclusive sem login). O telefone vai
-- para profile_private, que só o próprio dono lê e escreve.
CREATE TABLE public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own private read" ON public.profile_private FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own private insert" ON public.profile_private FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own private update" ON public.profile_private FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Copia os telefones já cadastrados antes de remover a coluna pública.
INSERT INTO public.profile_private (user_id, phone)
SELECT id, phone FROM public.profiles WHERE phone <> ''
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN phone;

-- 2. Participantes não podem alterar conversas ------------------------------
-- O UPDATE permitia trocar user_a, user_b e post_id. O app nunca faz UPDATE
-- direto; last_message_at é atualizado pelo trigger bump_conversation
-- (SECURITY DEFINER), que continua funcionando.
DROP POLICY IF EXISTS "participants update conv" ON public.conversations;
REVOKE UPDATE ON public.conversations FROM authenticated;

-- 3. Sem conversas duplicadas -----------------------------------------------
-- Une as duplicatas existentes (mantém a mais antiga e move as mensagens) e
-- cria um índice único por par de pessoas (em qualquer ordem) + post.
CREATE TEMP TABLE _conv_map ON COMMIT DROP AS
SELECT
  id,
  first_value(id) OVER w AS keep_id
FROM public.conversations
WINDOW w AS (
  PARTITION BY LEAST(user_a, user_b), GREATEST(user_a, user_b),
               COALESCE(post_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY created_at, id
);

UPDATE public.messages m
SET conversation_id = map.keep_id
FROM _conv_map map
WHERE m.conversation_id = map.id AND map.id <> map.keep_id;

UPDATE public.conversations c
SET last_message_at = agg.last_at
FROM (
  SELECT map.keep_id, max(c2.last_message_at) AS last_at
  FROM _conv_map map
  JOIN public.conversations c2 ON c2.id = map.id
  GROUP BY map.keep_id
) agg
WHERE c.id = agg.keep_id AND c.last_message_at < agg.last_at;

DELETE FROM public.conversations c
USING _conv_map map
WHERE c.id = map.id AND map.id <> map.keep_id;

CREATE UNIQUE INDEX conversations_pair_post_uniq ON public.conversations (
  LEAST(user_a, user_b),
  GREATEST(user_a, user_b),
  COALESCE(post_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
