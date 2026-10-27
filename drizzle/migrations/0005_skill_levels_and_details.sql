-- Habilidades passam a ter 3 níveis e mais detalhes (formulário "Adicionar habilidade").
--   1 = Quase profissional (pouca supervisão)
--   2 = Profissional (sem supervisão)
--   3 = Especialista (pode treinar outros)
-- "Profissional certificado" deixa de ser um nível e vira o campo certified.

ALTER TABLE public.profile_skills DROP CONSTRAINT profile_skills_level_check;

ALTER TABLE public.profile_skills
  ADD COLUMN has_experience boolean NOT NULL DEFAULT false,
  ADD COLUMN had_training boolean NOT NULL DEFAULT false,
  ADD COLUMN certified boolean NOT NULL DEFAULT false,
  ADD COLUMN years_experience smallint CHECK (years_experience BETWEEN 0 AND 60),
  ADD COLUMN notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Conversão dos níveis antigos (1..5) para os novos (1..3).
UPDATE public.profile_skills
SET certified = (level = 5),
    level = CASE WHEN level <= 2 THEN 1 WHEN level = 3 THEN 2 ELSE 3 END,
    updated_at = created_at;

ALTER TABLE public.profile_skills ADD CONSTRAINT profile_skills_level_check CHECK (level BETWEEN 1 AND 3);

-- "Atualizado em": muda sozinho a cada edição da habilidade.
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER profile_skills_touch BEFORE UPDATE ON public.profile_skills
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
