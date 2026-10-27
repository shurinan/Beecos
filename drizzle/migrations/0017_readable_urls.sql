-- Endereços legíveis: cada perfil e cada vaga ganha um "slug" fixo (bruno-espindola, chuveiro-queimou-a3f9c1).
-- O slug nasce uma vez e não muda, mesmo que a pessoa troque de nome ou a vaga troque de título,
-- para que links já compartilhados continuem funcionando. Quem gera é o banco; o app não escolhe.
-- Depende de 0000 (profiles, posts).

CREATE FUNCTION public.slugify(_t text, _max integer DEFAULT 60) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(left(btrim(regexp_replace(
    translate(lower(coalesce(_t, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'), '-'), _max), '-')
$$;

ALTER TABLE public.profiles ADD COLUMN slug text;
ALTER TABLE public.posts ADD COLUMN slug text;

-- Perfil: nasce quando a pessoa tem nome. Repetidos ganham número (bruno-espindola-2).
CREATE FUNCTION public.set_profile_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; cand text; n integer := 1;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    NEW.slug := OLD.slug; -- fixo
    RETURN NEW;
  END IF;
  NEW.slug := NULL;
  IF btrim(coalesce(NEW.full_name, '')) = '' THEN RETURN NEW; END IF;
  base := public.slugify(NEW.full_name, 50);
  -- palavras que são páginas do app não podem virar nome de perfil
  IF base = '' OR base IN ('contato', 'editar', 'novo', 'eu', 'comunidade') THEN base := 'usuario'; END IF;
  cand := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = cand AND id <> NEW.id) LOOP
    n := n + 1;
    cand := base || '-' || n;
  END LOOP;
  NEW.slug := cand;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_profile_slug() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_slug BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_slug();

-- Vaga: título + código curto único (cada vaga tem o seu).
CREATE FUNCTION public.set_post_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; cand text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    NEW.slug := OLD.slug; -- fixo
    RETURN NEW;
  END IF;
  base := coalesce(nullif(public.slugify(NEW.title, 50), ''), 'vaga');
  LOOP
    cand := base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.posts WHERE slug = cand);
  END LOOP;
  NEW.slug := cand;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_post_slug() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER posts_slug BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_post_slug();

-- Quem já existe: gera o slug passando pelo gatilho (um UPDATE que não muda nada).
UPDATE public.profiles SET full_name = full_name WHERE slug IS NULL;
UPDATE public.posts SET title = title WHERE slug IS NULL;
ALTER TABLE public.posts ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX posts_slug_key ON public.posts (slug);
CREATE UNIQUE INDEX profiles_slug_key ON public.profiles (slug) WHERE slug IS NOT NULL;
