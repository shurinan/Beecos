-- Informações pessoais (privadas): nome completo em partes e autorização do uso dos dados.
-- Foto de perfil (pública): arquivo no bucket "avatars", caminho guardado em profiles.avatar_path.
-- Depende da 0003 (profile_private) e da 0006 (contact_*).

ALTER TABLE public.profile_private
  ADD COLUMN first_name text NOT NULL DEFAULT '' CHECK (char_length(first_name) <= 60),
  ADD COLUMN last_name text NOT NULL DEFAULT '' CHECK (char_length(last_name) <= 60),
  ADD COLUMN other_names text NOT NULL DEFAULT '' CHECK (char_length(other_names) <= 100),
  ADD COLUMN name_suffix text NOT NULL DEFAULT '' CHECK (char_length(name_suffix) <= 20),
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN consent_version text NOT NULL DEFAULT '' CHECK (char_length(consent_version) <= 20);

-- O caminho da foto precisa estar na pasta do próprio dono.
ALTER TABLE public.profiles
  ADD COLUMN avatar_path text CHECK (avatar_path IS NULL OR (char_length(avatar_path) <= 200 AND avatar_path LIKE id::text || '/%'));

-- Bucket público (a foto aparece no perfil público), só imagens de até 2 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Escrever só na própria pasta (primeira parte do caminho = id do usuário).
CREATE POLICY "avatars own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
