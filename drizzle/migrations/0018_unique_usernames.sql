-- Nome de usuário único: o slug do perfil passa a ser o "nome de usuário" (estilo rede social).
-- Ninguém ganha número automático (bruno-espindola-2): se o nome já está em uso, o perfil fica sem
-- nome de usuário até a pessoa escolher outro, e o link usa o id enquanto isso.
-- A pessoa pode trocar o próprio nome de usuário (links antigos com o nome anterior deixam de funcionar).
-- Depende de 0017.

CREATE FUNCTION public.reserved_usernames() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['contato', 'editar', 'novo', 'eu', 'comunidade', 'vagas', 'perfil', 'conversas', 'avisos',
               'auth', 'admin', 'api', 'painel', 'mensagens', 'publicacao', 'suporte', 'beecos', 'outros',
               'usuario', 'ajuda', 'sobre', 'termos', 'privacidade']
$$;

CREATE OR REPLACE FUNCTION public.set_profile_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cand text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    -- a pessoa escolheu um nome de usuário
    IF NEW.slug IS NULL THEN RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '23514'; END IF;
    NEW.slug := lower(btrim(NEW.slug));
    IF NEW.slug !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' OR NEW.slug ~ '--'
       OR NEW.slug = ANY (public.reserved_usernames()) THEN
      RAISE EXCEPTION 'USUARIO_INVALIDO' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE slug = NEW.slug AND id <> NEW.id) THEN
      RAISE EXCEPTION 'USUARIO_EM_USO' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF; -- já tem: fica como está

  -- sugestão inicial a partir do nome, só se estiver livre e válida (sem número no fim)
  cand := public.slugify(NEW.full_name, 30);
  IF cand ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' AND cand !~ '--' AND NOT (cand = ANY (public.reserved_usernames()))
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = cand AND id <> NEW.id) THEN
    NEW.slug := cand;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_profile_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserved_usernames() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserved_usernames() TO authenticated;

-- Para o app avisar "já está em uso" enquanto a pessoa digita (sem expor mais nada).
CREATE FUNCTION public.username_available(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(btrim(_name)) ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' AND lower(btrim(_name)) !~ '--'
     AND NOT (lower(btrim(_name)) = ANY (public.reserved_usernames()))
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = lower(btrim(_name)) AND id IS DISTINCT FROM auth.uid())
$$;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;

-- Corrige o que já existe: números automáticos (-2, -3...) saem; quem ficar com nome repetido fica sem
-- nome de usuário até escolher. Hoje não há nenhum caso, mas a migration vale para qualquer base.
ALTER TABLE public.profiles DISABLE TRIGGER profiles_slug;
UPDATE public.profiles SET slug = NULL WHERE slug ~ '-[0-9]+$' AND slug IN (
  SELECT slug FROM public.profiles WHERE slug ~ '-[0-9]+$'
) AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.slug = regexp_replace(profiles.slug, '-[0-9]+$', ''));
ALTER TABLE public.profiles ENABLE TRIGGER profiles_slug;
