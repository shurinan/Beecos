-- Chat: mensagens não lidas, "visto por último", tempo de resposta.
-- Moderação: lista de termos bloqueados aplicada no banco (não dá para burlar pelo app).
-- Anexos no chat: imagem ou PDF de até 2 MB, em armazenamento privado só dos dois da conversa.
-- Depende de 0000 (conversations, messages), 0004 (reviews, profile_skills).

-- 1. Leitura por conversa: a última vez que cada participante abriu a conversa
CREATE TABLE public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.conversation_reads TO authenticated;
GRANT ALL ON public.conversation_reads TO service_role;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads select" ON public.conversation_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own reads insert" ON public.conversation_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)));
CREATE POLICY "own reads update" ON public.conversation_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE FUNCTION public.mark_conversation_read(_conversation uuid) RETURNS void
LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (_conversation, auth.uid(), now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = greatest(public.conversation_reads.last_read_at, EXCLUDED.last_read_at)
$$;

-- Quantas mensagens de outras pessoas ainda não foram lidas, por conversa
CREATE FUNCTION public.unread_counts() RETURNS TABLE (conversation_id uuid, unread bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT m.conversation_id, count(*)
  FROM public.messages m
  LEFT JOIN public.conversation_reads r
    ON r.conversation_id = m.conversation_id AND r.user_id = auth.uid()
  WHERE m.sender_id <> auth.uid() AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
  GROUP BY m.conversation_id
$$;

-- 2. Presença: "visto por último". Só quem tem conversa com a pessoa vê, e ela pode desligar.
CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  show_last_seen boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence select" ON public.user_presence FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR (show_last_seen AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.user_a = auth.uid() AND c.user_b = user_presence.user_id)
       OR (c.user_b = auth.uid() AND c.user_a = user_presence.user_id))));
CREATE POLICY "presence insert" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "presence update" ON public.user_presence FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE FUNCTION public.touch_presence() RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.user_presence (user_id, last_seen_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()
$$;

CREATE FUNCTION public.set_show_last_seen(_show boolean) RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.user_presence (user_id, show_last_seen) VALUES (auth.uid(), _show)
  ON CONFLICT (user_id) DO UPDATE SET show_last_seen = _show
$$;

-- 3. Tempo de resposta: mediana entre receber uma mensagem e responder (só intervalos de até 3 dias).
-- Devolve só números agregados, por isso pode ser público.
CREATE FUNCTION public.reply_stats(_user uuid) RETURNS TABLE (replies bigint, median_seconds numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ordered AS (
    SELECT sender_id, created_at,
           lag(sender_id) OVER w AS prev_sender,
           lag(created_at) OVER w AS prev_at
    FROM public.messages
    WHERE conversation_id IN (SELECT id FROM public.conversations WHERE _user IN (user_a, user_b))
    WINDOW w AS (PARTITION BY conversation_id ORDER BY created_at, id)
  ), gaps AS (
    SELECT extract(epoch FROM created_at - prev_at) AS secs
    FROM ordered
    WHERE sender_id = _user AND prev_sender <> _user AND created_at - prev_at <= interval '3 days'
  )
  SELECT count(*), coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY secs)::numeric, 0) FROM gaps
$$;

-- 4. Moderação de texto
CREATE TABLE public.blocked_terms (
  term text PRIMARY KEY,
  -- true: também vale se estiver colado/espaçado no meio do texto (só para termos longos)
  anywhere boolean NOT NULL DEFAULT false
);
ALTER TABLE public.blocked_terms ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.blocked_terms TO service_role;
-- sem política e sem GRANT para anon/authenticated: ninguém lê a lista pelo app

-- minúsculas, sem acento, "leet" (4=a, 0=o…), só letras, letras repetidas viram uma
CREATE FUNCTION public.normalize_text(_t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(_t, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ0134578@$',
      'aaaaaeeeeiiiiooooouuuucnoieastbas'),
    '[^a-z]+', ' ', 'g'), '(.)\1+', '\1', 'g'))
$$;

CREATE FUNCTION public.contains_blocked_term(_t text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH n AS (SELECT public.normalize_text(_t) AS s)
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_terms b, n
    WHERE (' ' || n.s || ' ') LIKE '% ' || b.term || ' %'
       OR (b.anywhere AND replace(n.s, ' ', '') LIKE '%' || replace(b.term, ' ', '') || '%')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.contains_blocked_term(text) FROM PUBLIC;

-- Lista inicial: xingamentos e ofensas discriminatórias, e anúncios de coisas ilegais.
-- É um ponto de partida: ajuste pelo banco (INSERT/DELETE em blocked_terms) sem mexer no código.
INSERT INTO public.blocked_terms (term, anywhere)
SELECT public.normalize_text(t), a FROM (VALUES
  ('puta', false), ('puto', false), ('filho da puta', true), ('filha da puta', true), ('fdp', false),
  ('vai se foder', true), ('vai tomar no cu', true), ('tomar no cu', true), ('vai a merda', false),
  ('arrombado', false), ('arrombada', false), ('cuzao', false), ('babaca', false), ('otario', false),
  ('otaria', false), ('imbecil', false), ('idiota', false), ('retardado', false), ('retardada', false),
  ('mongoloide', false), ('vagabundo', false), ('vagabunda', false), ('safado', false), ('safada', false),
  ('desgracado', false), ('desgracada', false), ('lixo humano', false), ('verme', false),
  ('viado', false), ('boiola', false), ('sapatao', false), ('traveco', false),
  ('crioulo', false), ('neguinho fedido', true), ('preto fedido', true), ('macaco imundo', true),
  ('nazista', false), ('hitler tinha razao', true),
  ('vou te matar', true), ('vou matar voce', true), ('vou te pegar', false), ('te mato', false),
  ('cocaina', false), ('crack', false), ('maconha', false), ('lsd', false), ('ecstasy', false), ('mdma', false),
  ('vendo droga', true), ('vendo arma', true), ('arma de fogo', true), ('municao', false),
  ('documento falso', true), ('rg falso', true), ('cnh falsa', true), ('nota fria', true),
  ('cartao clonado', true), ('cartao clonados', true), ('clonar cartao', true), ('lavagem de dinheiro', true),
  ('pirataria', false), ('menor de idade nua', true), ('pedofilia', false), ('pornografia infantil', true)
) AS v(t, a)
ON CONFLICT (term) DO NOTHING;

CREATE FUNCTION public.reject_blocked_text() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  col text;
  val text;
BEGIN
  -- sem usuário logado (cadastro, tarefas do servidor): não filtra
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  FOREACH col IN ARRAY TG_ARGV LOOP
    val := to_jsonb(NEW) ->> col;
    IF val IS NULL OR val = '' THEN CONTINUE; END IF;
    -- numa edição, só olha o que mudou
    IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) ->> col) IS NOT DISTINCT FROM val THEN CONTINUE; END IF;
    IF public.contains_blocked_term(val) THEN
      RAISE EXCEPTION 'TEXTO_BLOQUEADO' USING ERRCODE = 'P0001', HINT = col;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

-- 5. Anexos no chat (imagem ou PDF, até 2 MB)
ALTER TABLE public.messages
  ADD COLUMN attachment_path text,
  ADD COLUMN attachment_name text CHECK (attachment_name IS NULL OR char_length(attachment_name) BETWEEN 1 AND 120),
  ADD COLUMN attachment_type text CHECK (attachment_type IS NULL OR attachment_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  ADD COLUMN attachment_size integer CHECK (attachment_size IS NULL OR attachment_size BETWEEN 1 AND 2097152);

-- ou tem os quatro campos do anexo, ou nenhum; o arquivo fica na pasta da própria conversa
ALTER TABLE public.messages ADD CONSTRAINT messages_attachment_complete CHECK (
  (attachment_path IS NULL AND attachment_name IS NULL AND attachment_type IS NULL AND attachment_size IS NULL)
  OR (attachment_path IS NOT NULL AND attachment_name IS NOT NULL AND attachment_type IS NOT NULL
      AND attachment_size IS NOT NULL
      AND attachment_path LIKE conversation_id::text || '/%' AND char_length(attachment_path) <= 200));

-- o texto pode ficar vazio quando há anexo
ALTER TABLE public.messages DROP CONSTRAINT messages_content_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_check CHECK (
  length(content) <= 2000 AND (length(content) >= 1 OR attachment_path IS NOT NULL));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-files', 'chat-files', false, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Só os dois da conversa enviam e leem; ninguém edita nem apaga (o histórico fica íntegro).
CREATE POLICY "chat files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1] AND auth.uid() IN (c.user_a, c.user_b)));
CREATE POLICY "chat files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1] AND auth.uid() IN (c.user_a, c.user_b)));

CREATE TRIGGER messages_moderation BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('content', 'attachment_name');
CREATE TRIGGER posts_moderation BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('title', 'description');
CREATE TRIGGER reviews_moderation BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('comment');
CREATE TRIGGER profiles_moderation BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('full_name', 'headline', 'bio', 'service_area', 'certificate_note');
CREATE TRIGGER profile_skills_moderation BEFORE INSERT OR UPDATE ON public.profile_skills
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('skill', 'notes');

-- Funções: só quem está logado chama (reply_stats também é lida no perfil público)
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid), public.unread_counts(),
  public.touch_presence(), public.set_show_last_seen(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid), public.unread_counts(),
  public.touch_presence(), public.set_show_last_seen(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_stats(uuid) TO anon, authenticated;
