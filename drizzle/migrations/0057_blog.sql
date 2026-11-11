-- Blog do Beecos: artigos da equipe e da comunidade (só Premium escreve). Nada vai ao ar sozinho:
-- a equipe aprova, ajusta e publica, ou recusa com o motivo.
-- O autor só mexe no rascunho (draft). A versão no ar (title, body_html, ...) só muda quando a equipe publica,
-- então um artigo publicado continua no ar enquanto a nova versão espera a revisão.

-- ── quem pode escrever ──────────────────────────────────────────────────────────────────────────
-- Premium ativo ou equipe, e conta não suspensa.
CREATE OR REPLACE FUNCTION public.can_write_blog(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL
    AND (public.is_premium(_uid) OR EXISTS (SELECT 1 FROM public.moderators m WHERE m.user_id = _uid))
    AND NOT EXISTS (SELECT 1 FROM public.account_holds h WHERE h.user_id = _uid AND h.role = 'suspended'
                    AND h.lifted_at IS NULL AND h.ends_at > now())
$$;
REVOKE EXECUTE ON FUNCTION public.can_write_blog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_blog(uuid) TO authenticated;

-- ── artigos ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- rascunho do autor: {title, excerpt, body_html, cover_path, topic, signature}
  draft jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(draft) = 'object' AND length(draft::text) <= 300000),
  -- situação do rascunho: escrevendo, na fila da equipe, recusado (corrigir) ou igual ao que está no ar
  review text NOT NULL DEFAULT 'draft' CHECK (review IN ('draft', 'pending', 'rejected', 'approved')),
  review_note text CHECK (char_length(review_note) <= 1000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- versão no ar
  status text NOT NULL DEFAULT 'none' CHECK (status IN ('none', 'published', 'removed')),
  slug text UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,90}$'),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 140),
  excerpt text NOT NULL DEFAULT '' CHECK (char_length(excerpt) <= 300),
  body_html text NOT NULL DEFAULT '' CHECK (char_length(body_html) <= 200000),
  cover_path text CHECK (char_length(cover_path) <= 200),
  topic text CHECK (char_length(topic) <= 40),
  signature boolean NOT NULL DEFAULT true,
  reading_min smallint NOT NULL DEFAULT 1,
  -- publicado com ajustes da equipe (o autor foi avisado)
  adjusted boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  live_updated_at timestamptz,
  removed_note text CHECK (char_length(removed_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX articles_live_idx ON public.articles (published_at DESC) WHERE status = 'published';
CREATE INDEX articles_author_idx ON public.articles (author_id, updated_at DESC);
CREATE INDEX articles_queue_idx ON public.articles (submitted_at) WHERE review = 'pending';

REVOKE ALL ON public.articles FROM anon, authenticated;
GRANT SELECT, DELETE ON public.articles TO authenticated;
-- o autor só consegue gravar o rascunho; o resto muda pelas funções abaixo
GRANT UPDATE (draft) ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- quem lê a tabela: o autor e a equipe. Os leitores do blog usam blog_list/blog_article (só a versão no ar).
CREATE POLICY "articles own or team read" ON public.articles FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.is_moderator());
-- rascunho: só o autor, com Premium, e fora da fila (para a equipe não revisar um texto que muda)
CREATE POLICY "articles own draft update" ON public.articles FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND review <> 'pending')
  WITH CHECK (author_id = auth.uid() AND public.can_write_blog(auth.uid()));
CREATE POLICY "articles own delete" ON public.articles FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- mexeu no rascunho de um artigo já publicado: volta a ser rascunho (precisa enviar de novo)
CREATE OR REPLACE FUNCTION public.articles_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.draft IS DISTINCT FROM OLD.draft AND OLD.review IN ('approved') AND NEW.review = OLD.review THEN
    NEW.review := 'draft';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER articles_touch BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.articles_touch();

-- ── ajudantes ───────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.article_text(_html text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(regexp_replace(coalesce(_html, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.article_slug(_title text, _id uuid)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(nullif(left(btrim(regexp_replace(
           translate(lower(coalesce(_title, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
           '[^a-z0-9]+', '-', 'g'), '-'), 70), ''), 'artigo')
         || '-' || substr(replace(_id::text, '-', ''), 1, 6)
$$;

-- ── autor: criar, enviar para revisão, retirar da fila ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_article()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); nid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_write_blog(me) THEN RAISE EXCEPTION 'SO_PREMIUM' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM public.articles WHERE author_id = me AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'LIMITE_DIA';
  END IF;
  IF (SELECT count(*) FROM public.articles WHERE author_id = me AND status = 'none' AND review IN ('draft', 'rejected')) >= 10 THEN
    RAISE EXCEPTION 'MUITOS_RASCUNHOS';
  END IF;
  INSERT INTO public.articles (author_id, draft)
  VALUES (me, jsonb_build_object('title', '', 'excerpt', '', 'body_html', '', 'signature', true))
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_article() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_article() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_article(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a record; t text; who text;
BEGIN
  SELECT * INTO a FROM public.articles WHERE id = _id AND author_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO'; END IF;
  IF NOT public.can_write_blog(me) THEN RAISE EXCEPTION 'SO_PREMIUM' USING ERRCODE = '42501'; END IF;
  IF a.review = 'pending' THEN RETURN; END IF;
  IF a.review = 'approved' THEN RAISE EXCEPTION 'NADA_NOVO'; END IF;
  t := btrim(coalesce(a.draft ->> 'title', ''));
  IF char_length(t) < 5 THEN RAISE EXCEPTION 'TITULO_CURTO'; END IF;
  IF char_length(public.article_text(a.draft ->> 'body_html')) < 300 THEN RAISE EXCEPTION 'TEXTO_CURTO'; END IF;
  IF (SELECT count(*) FROM public.articles WHERE author_id = me AND submitted_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'LIMITE_DIA';
  END IF;
  UPDATE public.articles SET review = 'pending', submitted_at = now(), review_note = NULL WHERE id = _id;
  -- avisa a equipe (menos quem enviou)
  SELECT coalesce(nullif(full_name, ''), 'Alguém') INTO who FROM public.profiles WHERE id = me;
  INSERT INTO public.notifications (user_id, kind, title, body)
  SELECT m.user_id, 'article_review', 'Artigo para revisar', '“' || left(t, 80) || '”, de ' || who || '.'
  FROM public.moderators m WHERE m.user_id <> me;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_article(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_article(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_article(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.articles SET review = 'draft' WHERE id = _id AND author_id = auth.uid() AND review = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.withdraw_article(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_article(uuid) TO authenticated;

-- ── equipe: aprovar, ajustar e publicar, recusar, tirar do ar ──────────────────────────────────
-- _decision: 'approve' (publica como o autor mandou), 'adjust' (publica a versão editada pela equipe,
-- _draft, e avisa o autor do ajuste) ou 'reject' (volta para o autor com o motivo em _note).
CREATE OR REPLACE FUNCTION public.review_article(_id uuid, _decision text, _note text DEFAULT NULL, _draft jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; d jsonb; t text; s text; words integer; note text := nullif(btrim(coalesce(_note, '')), '');
BEGIN
  PERFORM public.admin_guard();
  SELECT * INTO a FROM public.articles WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO'; END IF;
  IF a.review <> 'pending' THEN RAISE EXCEPTION 'FORA_DA_FILA'; END IF;

  IF _decision = 'reject' THEN
    IF note IS NULL THEN RAISE EXCEPTION 'MOTIVO_OBRIGATORIO'; END IF;
    UPDATE public.articles SET review = 'rejected', review_note = left(note, 1000), reviewed_at = now(), reviewed_by = auth.uid()
     WHERE id = _id;
    IF a.author_id <> auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, body)
      VALUES (a.author_id, 'article_rejected', 'Seu artigo precisa de correções',
              '“' || left(coalesce(nullif(a.draft ->> 'title', ''), 'Sem título'), 80) || '”: ' || left(note, 300));
    END IF;
    INSERT INTO public.admin_actions (admin_id, target_id, action, details)
    VALUES (auth.uid(), a.author_id, 'article_reject', jsonb_build_object('article', _id, 'note', note));
    RETURN NULL;
  END IF;

  IF _decision NOT IN ('approve', 'adjust') THEN RAISE EXCEPTION 'DECISAO_INVALIDA'; END IF;
  d := CASE WHEN _decision = 'adjust' AND _draft IS NOT NULL THEN _draft ELSE a.draft END;
  IF jsonb_typeof(d) <> 'object' OR length(d::text) > 300000 THEN RAISE EXCEPTION 'RASCUNHO_INVALIDO'; END IF;
  t := btrim(coalesce(d ->> 'title', ''));
  IF char_length(t) < 5 THEN RAISE EXCEPTION 'TITULO_CURTO'; END IF;
  s := coalesce(a.slug, public.article_slug(t, a.id));
  words := coalesce(array_length(regexp_split_to_array(nullif(public.article_text(d ->> 'body_html'), ''), '\s+'), 1), 0);

  UPDATE public.articles SET
    draft = d,
    review = 'approved', review_note = CASE WHEN _decision = 'adjust' THEN note END,
    reviewed_at = now(), reviewed_by = auth.uid(),
    status = 'published', slug = s,
    title = left(t, 140),
    excerpt = left(coalesce(nullif(btrim(d ->> 'excerpt'), ''), left(public.article_text(d ->> 'body_html'), 220)), 300),
    body_html = left(coalesce(d ->> 'body_html', ''), 200000),
    cover_path = nullif(left(coalesce(d ->> 'cover_path', ''), 200), ''),
    topic = nullif(left(coalesce(d ->> 'topic', ''), 40), ''),
    signature = coalesce((d ->> 'signature')::boolean, true),
    reading_min = greatest(1, round(words / 200.0))::smallint,
    adjusted = (_decision = 'adjust'),
    published_at = coalesce(a.published_at, now()),
    live_updated_at = now(),
    removed_note = NULL
  WHERE id = _id;

  IF a.author_id <> auth.uid() THEN
    IF _decision = 'adjust' THEN
      INSERT INTO public.notifications (user_id, kind, title, body)
      VALUES (a.author_id, 'article_adjusted', 'Seu artigo foi publicado com ajustes',
              '“' || left(t, 80) || '” já está no blog. ' || coalesce('A equipe ajustou: ' || left(note, 300), 'A equipe fez pequenos ajustes.'));
    ELSE
      INSERT INTO public.notifications (user_id, kind, title, body)
      VALUES (a.author_id, 'article_published', 'Seu artigo foi publicado! 🎉',
              '“' || left(t, 80) || '” já está no blog do Beecos.');
    END IF;
  END IF;
  INSERT INTO public.admin_actions (admin_id, target_id, action, details)
  VALUES (auth.uid(), a.author_id, 'article_' || _decision, jsonb_build_object('article', _id, 'note', note));
  RETURN s;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_article(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_article(uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_article(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; note text := nullif(btrim(coalesce(_note, '')), '');
BEGIN
  PERFORM public.admin_guard();
  IF note IS NULL THEN RAISE EXCEPTION 'MOTIVO_OBRIGATORIO'; END IF;
  SELECT * INTO a FROM public.articles WHERE id = _id AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO'; END IF;
  UPDATE public.articles SET status = 'removed', removed_note = left(note, 1000) WHERE id = _id;
  IF a.author_id <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (a.author_id, 'article_removed', 'Seu artigo saiu do blog', '“' || left(a.title, 80) || '”: ' || left(note, 300));
  END IF;
  INSERT INTO public.admin_actions (admin_id, target_id, action, details)
  VALUES (auth.uid(), a.author_id, 'article_remove', jsonb_build_object('article', _id, 'note', note));
END $$;
REVOKE EXECUTE ON FUNCTION public.remove_article(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_article(uuid, text) TO authenticated;

-- fila e lista da equipe
CREATE OR REPLACE FUNCTION public.admin_articles()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'pending', coalesce((
      SELECT jsonb_agg(r ORDER BY r.submitted_at) FROM (
        SELECT a.id, a.author_id, a.draft, a.submitted_at, a.status, a.slug, a.title AS live_title,
               coalesce(nullif(p.full_name, ''), 'Sem nome') AS author_name, p.slug AS author_username,
               p.avatar_path AS author_avatar, EXISTS (SELECT 1 FROM public.moderators m WHERE m.user_id = a.author_id) AS team,
               public.article_author(a.author_id) AS author
        FROM public.articles a LEFT JOIN public.profiles p ON p.id = a.author_id
        WHERE a.review = 'pending') r), '[]'::jsonb),
    'published', coalesce((
      SELECT jsonb_agg(r ORDER BY r.published_at DESC) FROM (
        SELECT a.id, a.slug, a.title, a.published_at, a.adjusted, a.status,
               coalesce(nullif(p.full_name, ''), 'Sem nome') AS author_name
        FROM public.articles a LEFT JOIN public.profiles p ON p.id = a.author_id
        WHERE a.status = 'published' ORDER BY a.published_at DESC LIMIT 100) r), '[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_articles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_articles() TO authenticated;

-- ── leitura pública (só a versão no ar) ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.article_author(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'name', coalesce(nullif(p.full_name, ''), 'Autor'), 'username', p.slug,
    'avatar_path', p.avatar_path, 'headline', p.headline, 'city', p.city,
    'verified', EXISTS (SELECT 1 FROM public.user_checks c WHERE c.user_id = p.id AND c.document_at IS NOT NULL),
    'team', EXISTS (SELECT 1 FROM public.moderators m WHERE m.user_id = p.id))
  FROM public.profiles p WHERE p.id = _id
$$;
REVOKE EXECUTE ON FUNCTION public.article_author(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.blog_list(_topic text DEFAULT NULL, _author uuid DEFAULT NULL,
                                            _before timestamptz DEFAULT NULL, _limit integer DEFAULT 12)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(r ORDER BY r.published_at DESC), '[]'::jsonb) FROM (
    SELECT a.id, a.slug, a.title, a.excerpt, a.cover_path, a.topic, a.published_at, a.reading_min,
           public.article_author(a.author_id) AS author
    FROM public.articles a
    WHERE a.status = 'published'
      AND (_topic IS NULL OR a.topic = _topic)
      AND (_author IS NULL OR a.author_id = _author)
      AND (_before IS NULL OR a.published_at < _before)
    ORDER BY a.published_at DESC
    LIMIT greatest(1, least(coalesce(_limit, 12), 50))) r
$$;
REVOKE EXECUTE ON FUNCTION public.blog_list(text, uuid, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blog_list(text, uuid, timestamptz, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.blog_article(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'title', a.title, 'excerpt', a.excerpt, 'body_html', a.body_html,
    'cover_path', a.cover_path, 'topic', a.topic, 'signature', a.signature, 'reading_min', a.reading_min,
    'published_at', a.published_at, 'updated_at', a.live_updated_at,
    'author', public.article_author(a.author_id))
  FROM public.articles a WHERE a.slug = _slug AND a.status = 'published'
$$;
REVOKE EXECUTE ON FUNCTION public.blog_article(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blog_article(text) TO anon, authenticated;

-- ── fotos dos artigos ───────────────────────────────────────────────────────────────────────────
-- blog/<id de quem enviou>/<arquivo>.jpg, públicas como o artigo. Enviar exige poder escrever.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog', 'blog', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
CREATE POLICY "blog images insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog' AND (storage.foldername(name))[1] = auth.uid()::text
              AND public.can_write_blog(auth.uid()));
CREATE POLICY "blog images delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blog' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "blog images own list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'blog' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── avisos ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('new_job', 'queue_turn', 'referral', 'suggestion_done', 'courtesy',
                  'article_review', 'article_published', 'article_adjusted', 'article_rejected', 'article_removed'));

-- notificação no celular: avisos de artigo abrem Meus artigos (ou a fila, para a equipe)
CREATE OR REPLACE FUNCTION public.push_on_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE url text := '/avisos';
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT '/vagas/' || coalesce(pr.slug, 'outros') || '/' || p.slug INTO url
    FROM public.posts p LEFT JOIN public.professions pr ON pr.id = p.profession_id WHERE p.id = NEW.post_id;
  ELSIF NEW.kind = 'article_review' THEN
    url := '/revisar-artigos';
  ELSIF NEW.kind LIKE 'article_%' THEN
    url := '/meus-artigos';
  END IF;
  PERFORM public.queue_push(NEW.user_id, NEW.title, NEW.body, coalesce(url, '/avisos'), 'aviso:' || NEW.id);
  RETURN NEW;
END $$;
