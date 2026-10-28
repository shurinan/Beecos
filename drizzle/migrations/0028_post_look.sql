-- Personalizar a vaga: cor e ícone da capa, selos (urgente, combinar valor) e destaque na lista (Premium).
ALTER TABLE public.posts
  ADD COLUMN cover_color text CHECK (cover_color IN ('#F9C80E', '#7FC8A9', '#8FB8F0', '#F2A48B', '#C9B5F0')),
  ADD COLUMN cover_icon text CHECK (cover_icon IN ('briefcase', 'zap', 'wrench', 'sparkles', 'hard-hat', 'truck', 'heart-pulse', 'scissors', 'bike', 'house')),
  ADD COLUMN urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN negotiable boolean NOT NULL DEFAULT false,
  ADD COLUMN highlight boolean NOT NULL DEFAULT false;

-- O destaque é do Premium: quem não é Premium não consegue ligar, nem por fora do app.
CREATE FUNCTION public.guard_post_highlight() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.highlight AND NOT public.is_premium(NEW.user_id) THEN
    NEW.highlight := false;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_post_highlight() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER posts_highlight_guard BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_highlight();
