-- Ferramentas da conversa (só de quem as usa): favoritar, fixar (até 3), arquivar, etiqueta,
-- recado/lembrete pessoal e "excluir para mim". Mais: links são proibidos no chat.

CREATE TABLE public.conversation_prefs (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  favorite boolean NOT NULL DEFAULT false,
  pinned_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  tag text CHECK (tag IN ('orcamento', 'combinado', 'aguardando', 'concluido')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  remind_at timestamptz,
  -- "excluir a conversa": some da lista e do histórico de quem excluiu; o outro continua vendo tudo
  cleared_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_prefs TO authenticated;
GRANT ALL ON public.conversation_prefs TO service_role;
REVOKE ALL ON public.conversation_prefs FROM anon;
ALTER TABLE public.conversation_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs read" ON public.conversation_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own prefs write" ON public.conversation_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)));
CREATE POLICY "own prefs update" ON public.conversation_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs delete" ON public.conversation_prefs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- no máximo 3 conversas fixadas por pessoa
CREATE FUNCTION public.limit_pinned_conversations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.pinned_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.pinned_at IS NULL) THEN
    IF (SELECT count(*) FROM public.conversation_prefs
        WHERE user_id = NEW.user_id AND pinned_at IS NOT NULL AND conversation_id <> NEW.conversation_id) >= 3 THEN
      RAISE EXCEPTION 'LIMITE_FIXADAS' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.limit_pinned_conversations() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER conversation_prefs_pin_limit BEFORE INSERT OR UPDATE ON public.conversation_prefs
  FOR EACH ROW EXECUTE FUNCTION public.limit_pinned_conversations();

-- o que foi excluído para mim não conta como não lido
CREATE OR REPLACE FUNCTION public.unread_counts() RETURNS TABLE (conversation_id uuid, unread bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT m.conversation_id, count(*)
  FROM public.messages m
  LEFT JOIN public.conversation_reads r
    ON r.conversation_id = m.conversation_id AND r.user_id = auth.uid()
  LEFT JOIN public.conversation_prefs p
    ON p.conversation_id = m.conversation_id AND p.user_id = auth.uid()
  WHERE m.sender_id <> auth.uid()
    AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
    AND (p.cleared_at IS NULL OR m.created_at > p.cleared_at)
  GROUP BY m.conversation_id
$$;

-- Links são proibidos no chat (golpes e fuga da plataforma): endereço, "www", encurtadores e domínios comuns.
CREATE FUNCTION public.contains_link(_t text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(_t, '') ~* '(https?:|ftp:|www\.|\m[a-z0-9-]+\.(com|net|org|edu|gov|br|io|me|app|link|ly|gl|co|info|xyz|site|online|store|shop|tv|cc|gg|dev|page|click|top|biz|us|ai)\M)'
$$;

CREATE FUNCTION public.reject_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.contains_link(NEW.content) THEN
    RAISE EXCEPTION 'LINK_BLOQUEADO' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.reject_links() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER messages_no_links BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_links();
