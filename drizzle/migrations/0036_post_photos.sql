-- Fotos da vaga (Premium): até 5 por publicação, públicas como a própria vaga.
-- Arquivo em post-photos/<id de quem publicou>/<id da vaga>/<arquivo>.jpg. Depende de 0028.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-photos', 'post-photos', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

CREATE TABLE public.post_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE CHECK (char_length(path) <= 200),
  sort smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_photos_post_idx ON public.post_photos (post_id, sort);
REVOKE ALL ON public.post_photos FROM anon, authenticated;
GRANT SELECT ON public.post_photos TO anon, authenticated;
GRANT INSERT, DELETE ON public.post_photos TO authenticated;
GRANT ALL ON public.post_photos TO service_role;
ALTER TABLE public.post_photos ENABLE ROW LEVEL SECURITY;

-- quem vê a vaga vê as fotos (vagas ocultas pela moderação escondem as fotos junto)
CREATE POLICY "photos readable" ON public.post_photos FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
-- só o dono, Premium, até 5, na pasta certa
CREATE POLICY "photos own insert" ON public.post_photos FOR INSERT TO authenticated
  WITH CHECK (
    public.is_premium(auth.uid())
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
    AND path LIKE auth.uid()::text || '/' || post_id::text || '/%'
    AND (SELECT count(*) FROM public.post_photos x WHERE x.post_id = post_photos.post_id) < 5);
CREATE POLICY "photos own delete" ON public.post_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

-- arquivos: envia e apaga só na própria pasta; enviar exige Premium
CREATE POLICY "post photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text
              AND public.is_premium(auth.uid()));
CREATE POLICY "post photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post photos own list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
