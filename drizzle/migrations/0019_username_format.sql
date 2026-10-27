-- Formato do nome de usuário "estilo Instagram": letras minúsculas sem acento, números, ponto, sublinhado e hífen.
-- 3 a 30 caracteres; não começa nem termina com ponto ou hífen; sem dois separadores seguidos (.., --, .-, ...).
-- Depende de 0018.

CREATE FUNCTION public.is_valid_username(_n text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _n ~ '^[a-z0-9_][a-z0-9._-]{1,28}[a-z0-9_]$'
     AND _n !~ '[._-][._-]'
     AND NOT (_n = ANY (public.reserved_usernames()))
$$;
REVOKE EXECUTE ON FUNCTION public.is_valid_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_username(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profile_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cand text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    IF NEW.slug IS NULL THEN RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '23514'; END IF;
    NEW.slug := lower(btrim(NEW.slug));
    IF NOT public.is_valid_username(NEW.slug) THEN
      RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE slug = NEW.slug AND id <> NEW.id) THEN
      RAISE EXCEPTION 'USUARIO_EM_USO' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;

  cand := public.slugify(NEW.full_name, 30);
  IF public.is_valid_username(cand) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = cand AND id <> NEW.id) THEN
    NEW.slug := cand;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_profile_slug() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.username_available(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_valid_username(lower(btrim(_name)))
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = lower(btrim(_name)) AND id IS DISTINCT FROM auth.uid())
$$;
