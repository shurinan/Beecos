-- Confirmação de leitura (tique duplo azul): a pessoa vê quando a outra abriu a conversa pela última vez.
-- Só quem está na conversa pergunta, e some se a outra escondeu o "visto por último" (como no WhatsApp).
CREATE FUNCTION public.conversation_other_read(_conversation uuid) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.last_read_at
  FROM public.conversation_reads r
  JOIN public.conversations c ON c.id = r.conversation_id
  LEFT JOIN public.user_presence p ON p.user_id = r.user_id
  WHERE r.conversation_id = _conversation
    AND auth.uid() IN (c.user_a, c.user_b)
    AND r.user_id <> auth.uid()
    AND coalesce(p.show_last_seen, true)
$$;
REVOKE ALL ON FUNCTION public.conversation_other_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_other_read(uuid) TO authenticated;
