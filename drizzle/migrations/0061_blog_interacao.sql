-- Blog: visualizações (sem contar quem escreveu), curtidas e comentários.

ALTER TABLE public.articles
  ADD COLUMN view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN comment_count integer NOT NULL DEFAULT 0;

-- uma visualização por pessoa por artigo (logado: pelo usuário; visitante: por um código do navegador)
CREATE TABLE public.article_views (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor text NOT NULL CHECK (char_length(visitor) BETWEEN 1 AND 70),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, visitor)
);
CREATE TABLE public.article_likes (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
CREATE TABLE public.article_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX article_comments_article_idx ON public.article_comments (article_id, created_at DESC);
CREATE INDEX article_comments_user_idx ON public.article_comments (user_id, created_at DESC);

-- as tabelas só mudam pelas funções abaixo
REVOKE ALL ON public.article_views, public.article_likes, public.article_comments FROM anon, authenticated;
GRANT ALL ON public.article_views, public.article_likes, public.article_comments TO service_role;
ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

-- ── visualização: quem escreveu o artigo não conta ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_article_view(_slug text, _visitor text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; who text; n integer;
BEGIN
  SELECT id, author_id INTO a FROM public.articles WHERE slug = _slug AND status = 'published';
  IF NOT FOUND THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() = a.author_id THEN RETURN; END IF;
  who := CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text
              WHEN nullif(btrim(coalesce(_visitor, '')), '') IS NOT NULL THEN 'v:' || left(btrim(_visitor), 60)
              ELSE NULL END;
  IF who IS NULL THEN RETURN; END IF;
  INSERT INTO public.article_views (article_id, visitor) VALUES (a.id, who) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN UPDATE public.articles SET view_count = view_count + 1 WHERE id = a.id; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_article_view(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_article_view(text, text) TO anon, authenticated;

-- números do artigo + se eu curti
CREATE OR REPLACE FUNCTION public.article_stats(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('views', a.view_count, 'likes', a.like_count, 'comments', a.comment_count,
    'liked', auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.article_likes l WHERE l.article_id = a.id AND l.user_id = auth.uid()))
  FROM public.articles a WHERE a.slug = _slug AND a.status = 'published'
$$;
REVOKE EXECUTE ON FUNCTION public.article_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.article_stats(text) TO anon, authenticated;

-- ── curtir (liga e desliga) ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_article_like(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; c integer; liked boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN'; END IF;
  PERFORM 1 FROM public.articles WHERE id = _id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO'; END IF;
  DELETE FROM public.article_likes WHERE article_id = _id AND user_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  liked := n = 0;
  IF liked THEN INSERT INTO public.article_likes (article_id, user_id) VALUES (_id, auth.uid()); END IF;
  SELECT count(*) INTO c FROM public.article_likes WHERE article_id = _id;
  UPDATE public.articles SET like_count = c WHERE id = _id;
  RETURN jsonb_build_object('liked', liked, 'likes', c);
END $$;
REVOKE EXECUTE ON FUNCTION public.toggle_article_like(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_article_like(uuid) TO authenticated;

-- ── comentários ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.article_comments_list(_slug text, _before timestamptz DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb) FROM (
    SELECT c.id, c.body, c.created_at,
           c.user_id = auth.uid() AS mine,
           jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), 'Sem nome'),
                              'username', p.slug, 'avatar_path', p.avatar_path) AS author
    FROM public.article_comments c
    JOIN public.articles a ON a.id = c.article_id AND a.slug = _slug AND a.status = 'published'
    JOIN public.profiles p ON p.id = c.user_id
    WHERE _before IS NULL OR c.created_at < _before
    ORDER BY c.created_at DESC
    LIMIT greatest(1, least(coalesce(_limit, 20), 50))) r
$$;
REVOKE EXECUTE ON FUNCTION public.article_comments_list(text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.article_comments_list(text, timestamptz, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_article_comment(_id uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; b text := btrim(coalesce(_body, '')); new_id uuid; who text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN'; END IF;
  IF char_length(b) < 1 THEN RAISE EXCEPTION 'COMENTARIO_VAZIO'; END IF;
  IF char_length(b) > 1000 THEN RAISE EXCEPTION 'COMENTARIO_LONGO'; END IF;
  SELECT id, author_id, title, slug INTO a FROM public.articles WHERE id = _id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO'; END IF;
  IF (SELECT count(*) FROM public.article_comments WHERE user_id = auth.uid() AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'MUITOS_COMENTARIOS';
  END IF;
  INSERT INTO public.article_comments (article_id, user_id, body) VALUES (a.id, auth.uid(), b) RETURNING id INTO new_id;
  UPDATE public.articles SET comment_count = comment_count + 1 WHERE id = a.id;
  IF a.author_id <> auth.uid() THEN
    SELECT coalesce(nullif(full_name, ''), 'Alguém') INTO who FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (a.author_id, 'article_comment', who || ' comentou no seu artigo',
            '“' || left(a.title, 60) || '”: ' || left(b, 200));
  END IF;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.add_article_comment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_article_comment(uuid, text) TO authenticated;

-- apaga: quem escreveu o comentário, o autor do artigo ou a equipe
CREATE OR REPLACE FUNCTION public.delete_article_comment(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LOGIN'; END IF;
  SELECT c2.id, c2.article_id, c2.user_id, a.author_id INTO c
  FROM public.article_comments c2 JOIN public.articles a ON a.id = c2.article_id
  WHERE c2.id = _id FOR UPDATE OF c2;
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO'; END IF;
  IF NOT (c.user_id = auth.uid() OR c.author_id = auth.uid() OR public.is_moderator()) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO';
  END IF;
  DELETE FROM public.article_comments WHERE id = _id;
  UPDATE public.articles SET comment_count = greatest(comment_count - 1, 0) WHERE id = c.article_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_article_comment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_article_comment(uuid) TO authenticated;

-- ── avisos ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('new_job', 'queue_turn', 'referral', 'suggestion_done', 'courtesy',
                  'article_review', 'article_published', 'article_adjusted', 'article_rejected', 'article_removed',
                  'article_comment'));
