-- Nome de usuário escolhido no cadastro. Depende de 0019.
-- O app manda `username` nos metadados do signUp; o gatilho de novo usuário valida e usa. Se o nome
-- estiver inválido ou em uso (ex.: duas pessoas ao mesmo tempo), a conta é criada mesmo assim, com a
-- sugestão automática a partir do nome (ou sem nome de usuário), e a pessoa escolhe depois.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wanted text := lower(btrim(coalesce(NEW.raw_user_meta_data->>'username', '')));
  fname text := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
BEGIN
  IF wanted <> '' AND public.is_valid_username(wanted)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = wanted) THEN
    BEGIN
      INSERT INTO public.profiles (id, full_name, slug) VALUES (NEW.id, fname, wanted)
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- alguém levou o nome no mesmo instante: segue sem ele
    END;
  END IF;
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, fname) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Um perfil criado direto (sem o gatilho) também não pode entrar com nome de usuário inválido.
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

  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(btrim(NEW.slug));
    IF NOT public.is_valid_username(NEW.slug) THEN
      RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  cand := public.slugify(NEW.full_name, 30);
  IF public.is_valid_username(cand) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = cand AND id <> NEW.id) THEN
    NEW.slug := cand;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_profile_slug() FROM PUBLIC, anon, authenticated;

-- Quem ainda não tem conta precisa poder ver se o nome está livre (os perfis já são públicos).
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon;
