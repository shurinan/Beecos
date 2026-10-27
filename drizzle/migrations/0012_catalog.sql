-- Catálogo de profissões em 3 níveis (setor > profissão > serviço) e habilidades/vagas ligadas a ele.
-- Depende de 0004 (profile_skills), 0006 (campos da habilidade) e 0009 (moderação de texto).

CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX professions_sector_idx ON public.professions (sector_id);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profession_id uuid NOT NULL REFERENCES public.professions(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (profession_id, slug)
);

-- O catálogo é público para leitura (inclusive para quem ainda não entrou); só o banco o altera.
REVOKE ALL ON public.sectors, public.professions, public.services FROM anon, authenticated;
GRANT SELECT ON public.sectors, public.professions, public.services TO anon, authenticated;
GRANT ALL ON public.sectors, public.professions, public.services TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog readable" ON public.sectors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog readable" ON public.professions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog readable" ON public.services FOR SELECT TO anon, authenticated USING (true);

-- Habilidades: a lista antiga era texto livre e só tinha cadastros de teste; recomeça pelo catálogo.
-- profession_id nulo = "Outro" (nome escrito pela pessoa, que fica em skill).
DELETE FROM public.profile_skills;
ALTER TABLE public.profile_skills
  ADD COLUMN profession_id uuid REFERENCES public.professions(id) ON DELETE SET NULL,
  ADD COLUMN service_ids uuid[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX profile_skills_profession_idx ON public.profile_skills (user_id, profession_id)
  WHERE profession_id IS NOT NULL;

-- Vagas e anúncios: profissão e serviço (opcionais; nulos = "Outro").
ALTER TABLE public.posts
  ADD COLUMN profession_id uuid REFERENCES public.professions(id) ON DELETE SET NULL,
  ADD COLUMN service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;
CREATE INDEX posts_profession_idx ON public.posts (profession_id) WHERE profession_id IS NOT NULL;

-- O serviço tem que ser da profissão escolhida; se vier só o serviço, a profissão sai dele.
CREATE FUNCTION public.check_post_catalog() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE sp uuid;
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    SELECT profession_id INTO sp FROM public.services WHERE id = NEW.service_id;
    IF sp IS NULL THEN RAISE EXCEPTION 'Serviço inválido' USING ERRCODE = '23514'; END IF;
    IF NEW.profession_id IS NULL THEN NEW.profession_id := sp;
    ELSIF NEW.profession_id <> sp THEN
      RAISE EXCEPTION 'O serviço não pertence a essa profissão' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posts_catalog BEFORE INSERT OR UPDATE OF profession_id, service_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.check_post_catalog();

-- Serviços marcados na habilidade têm que ser da profissão dela.
CREATE FUNCTION public.check_skill_catalog() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.profession_id IS NULL AND cardinality(NEW.service_ids) > 0 THEN
    RAISE EXCEPTION 'Serviços só podem ser marcados em uma profissão da lista' USING ERRCODE = '23514';
  END IF;
  IF cardinality(NEW.service_ids) > 0 AND EXISTS (
    SELECT 1 FROM unnest(NEW.service_ids) AS s(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.services sv WHERE sv.id = s.id AND sv.profession_id = NEW.profession_id)
  ) THEN
    RAISE EXCEPTION 'Há serviço que não pertence a essa profissão' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profile_skills_catalog BEFORE INSERT OR UPDATE ON public.profile_skills
  FOR EACH ROW EXECUTE FUNCTION public.check_skill_catalog();
REVOKE EXECUTE ON FUNCTION public.check_post_catalog(), public.check_skill_catalog() FROM PUBLIC, anon, authenticated;

-- Carga inicial. Para mudar o catálogo depois, rode de novo este tipo de comando (é idempotente).
INSERT INTO public.sectors (slug, name, sort) VALUES
  ('construcao-civil', 'Construção civil', 0),
  ('limpeza-e-conservacao', 'Limpeza e conservação', 1),
  ('jardinagem-e-piscinas', 'Jardinagem e piscinas', 2),
  ('beleza-e-estetica', 'Beleza e estética', 3),
  ('saude-e-bem-estar', 'Saúde e bem-estar', 4),
  ('cuidados-com-pessoas-e-pets', 'Cuidados com pessoas e pets', 5),
  ('transporte-mudancas-e-entregas', 'Transporte, mudanças e entregas', 6),
  ('tecnologia-e-assistencia-tecnica', 'Tecnologia e assistência técnica', 7),
  ('eventos-e-alimentacao', 'Eventos e alimentação', 8),
  ('automotivo', 'Automotivo', 9)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort = EXCLUDED.sort;

INSERT INTO public.professions (sector_id, slug, name, aliases, sort)
SELECT s.id, v.slug, v.name, v.aliases, v.sort FROM (VALUES
  ('construcao-civil', 'eletricista', 'Eletricista', ARRAY['eletrica','eletricista residencial','fiação','bico de eletricista']::text[], 0),
  ('construcao-civil', 'encanador', 'Encanador', ARRAY['hidráulica','bombeiro hidráulico','encanamento']::text[], 1),
  ('construcao-civil', 'pedreiro', 'Pedreiro', ARRAY['alvenaria','bico de pedreiro','pedreiro de obra']::text[], 2),
  ('construcao-civil', 'pintor', 'Pintor', ARRAY['pintura','pintor de parede','bico de pintor']::text[], 3),
  ('construcao-civil', 'gesseiro-e-drywall', 'Gesseiro e drywall', ARRAY['gesso','drywall','forro de gesso']::text[], 4),
  ('construcao-civil', 'azulejista-e-ladrilheiro', 'Azulejista e ladrilheiro', ARRAY['assentador de piso','piso e azulejo','revestimento']::text[], 5),
  ('construcao-civil', 'serralheiro', 'Serralheiro', ARRAY['serralheria','solda','soldador','ferreiro']::text[], 6),
  ('construcao-civil', 'marceneiro', 'Marceneiro', ARRAY['carpinteiro','móveis planejados','madeira']::text[], 7),
  ('construcao-civil', 'vidraceiro', 'Vidraceiro', ARRAY['vidros','box de banheiro','espelho']::text[], 8),
  ('construcao-civil', 'telhadista', 'Telhadista', ARRAY['telhado','telhas','calheiro']::text[], 9),
  ('construcao-civil', 'impermeabilizador', 'Impermeabilizador', ARRAY['impermeabilização','infiltração']::text[], 10),
  ('construcao-civil', 'instalador-de-ar-condicionado', 'Instalador de ar-condicionado', ARRAY['ar condicionado','split','climatização','refrigeração']::text[], 11),
  ('construcao-civil', 'servente-e-ajudante-de-obra', 'Servente e ajudante de obra', ARRAY['ajudante','servente','bico','ajudante geral']::text[], 12),
  ('construcao-civil', 'mestre-de-obras-e-empreiteiro', 'Mestre de obras e empreiteiro', ARRAY['empreiteiro','mestre de obra','reforma completa']::text[], 13),
  ('construcao-civil', 'instalador-de-piso-e-revestimento-de-madeira', 'Instalador de piso e revestimento de madeira', ARRAY['assoalho','taco','raspagem']::text[], 14),
  ('limpeza-e-conservacao', 'diarista', 'Diarista', ARRAY['faxineira','faxina','empregada doméstica','limpeza de casa']::text[], 0),
  ('limpeza-e-conservacao', 'limpeza-pos-obra', 'Limpeza pós-obra', ARRAY['pós obra','limpeza de obra']::text[], 1),
  ('limpeza-e-conservacao', 'limpador-de-estofados-e-tapetes', 'Limpador de estofados e tapetes', ARRAY['lavagem de sofá','higienização de colchão']::text[], 2),
  ('limpeza-e-conservacao', 'zelador-e-porteiro', 'Zelador e porteiro', ARRAY['zeladoria','portaria']::text[], 3),
  ('jardinagem-e-piscinas', 'jardineiro', 'Jardineiro', ARRAY['jardinagem','paisagismo','podador']::text[], 0),
  ('jardinagem-e-piscinas', 'piscineiro', 'Piscineiro', ARRAY['limpeza de piscina','tratamento de piscina']::text[], 1),
  ('beleza-e-estetica', 'cabeleireiro-a', 'Cabeleireiro(a)', ARRAY['cabelereiro','salão']::text[], 0),
  ('beleza-e-estetica', 'barbeiro', 'Barbeiro', ARRAY['barba']::text[], 1),
  ('beleza-e-estetica', 'manicure-e-pedicure', 'Manicure e pedicure', ARRAY['unha','esmaltação']::text[], 2),
  ('beleza-e-estetica', 'maquiador-a', 'Maquiador(a)', ARRAY['maquiagem']::text[], 3),
  ('beleza-e-estetica', 'designer-de-sobrancelhas', 'Designer de sobrancelhas', ARRAY['sobrancelha','cílios']::text[], 4),
  ('beleza-e-estetica', 'depilador-a', 'Depilador(a)', ARRAY['depilação']::text[], 5),
  ('saude-e-bem-estar', 'optometrista', 'Optometrista', ARRAY['óptica','exame de vista']::text[], 0),
  ('saude-e-bem-estar', 'tecnico-de-enfermagem', 'Técnico de enfermagem', ARRAY['enfermagem','enfermeiro']::text[], 1),
  ('saude-e-bem-estar', 'massoterapeuta', 'Massoterapeuta', ARRAY['massagem','massagista']::text[], 2),
  ('saude-e-bem-estar', 'fisioterapeuta', 'Fisioterapeuta', ARRAY['fisio']::text[], 3),
  ('saude-e-bem-estar', 'personal-trainer', 'Personal trainer', ARRAY['personal','educador físico']::text[], 4),
  ('cuidados-com-pessoas-e-pets', 'cuidador-a-de-idosos', 'Cuidador(a) de idosos', ARRAY['cuidador','acompanhante de idosos']::text[], 0),
  ('cuidados-com-pessoas-e-pets', 'baba', 'Babá', ARRAY['baba','cuidadora de crianças']::text[], 1),
  ('cuidados-com-pessoas-e-pets', 'passeador-e-cuidador-de-pets', 'Passeador e cuidador de pets', ARRAY['dog walker','pet sitter','banho e tosa']::text[], 2),
  ('transporte-mudancas-e-entregas', 'freteiro-e-motorista-de-mudanca', 'Freteiro e motorista de mudança', ARRAY['frete','carreto','mudança']::text[], 0),
  ('transporte-mudancas-e-entregas', 'ajudante-de-mudanca', 'Ajudante de mudança', ARRAY['carregador']::text[], 1),
  ('transporte-mudancas-e-entregas', 'montador-de-moveis', 'Montador de móveis', ARRAY['montagem de móveis']::text[], 2),
  ('transporte-mudancas-e-entregas', 'motoboy-e-entregador', 'Motoboy e entregador', ARRAY['motoboy','entrega','bike']::text[], 3),
  ('tecnologia-e-assistencia-tecnica', 'tecnico-de-informatica', 'Técnico de informática', ARRAY['computador','notebook','ti']::text[], 0),
  ('tecnologia-e-assistencia-tecnica', 'tecnico-de-celular', 'Técnico de celular', ARRAY['celular','smartphone']::text[], 1),
  ('tecnologia-e-assistencia-tecnica', 'tecnico-de-eletrodomesticos', 'Técnico de eletrodomésticos', ARRAY['geladeira','máquina de lavar','fogão']::text[], 2),
  ('tecnologia-e-assistencia-tecnica', 'instalador-de-cameras-e-alarmes', 'Instalador de câmeras e alarmes', ARRAY['cftv','segurança eletrônica','antena']::text[], 3),
  ('eventos-e-alimentacao', 'garcom-e-copeiro', 'Garçom e copeiro', ARRAY['garçon','copeira']::text[], 0),
  ('eventos-e-alimentacao', 'cozinheiro-a', 'Cozinheiro(a)', ARRAY['cozinha','chef']::text[], 1),
  ('eventos-e-alimentacao', 'churrasqueiro', 'Churrasqueiro', ARRAY['churrasco']::text[], 2),
  ('eventos-e-alimentacao', 'confeiteiro-a', 'Confeiteiro(a)', ARRAY['bolo','doces']::text[], 3),
  ('eventos-e-alimentacao', 'dj-e-som', 'DJ e som', ARRAY['dj','som']::text[], 4),
  ('eventos-e-alimentacao', 'fotografo-a', 'Fotógrafo(a)', ARRAY['fotografia','filmagem']::text[], 5),
  ('automotivo', 'mecanico', 'Mecânico', ARRAY['mecânica','carro','moto']::text[], 0),
  ('automotivo', 'eletricista-automotivo', 'Eletricista automotivo', ARRAY['auto elétrica']::text[], 1),
  ('automotivo', 'funileiro-e-pintor-automotivo', 'Funileiro e pintor automotivo', ARRAY['lanternagem','funilaria']::text[], 2),
  ('automotivo', 'borracheiro', 'Borracheiro', ARRAY['pneu']::text[], 3),
  ('automotivo', 'lavador-de-carros', 'Lavador de carros', ARRAY['lava jato','estética automotiva']::text[], 4)
) AS v(sector_slug, slug, name, aliases, sort) JOIN public.sectors s ON s.slug = v.sector_slug
ON CONFLICT (slug) DO UPDATE SET sector_id = EXCLUDED.sector_id, name = EXCLUDED.name, aliases = EXCLUDED.aliases, sort = EXCLUDED.sort;

INSERT INTO public.services (profession_id, slug, name, aliases, sort, active)
SELECT p.id, v.slug, v.name, v.aliases, v.sort, v.active FROM (VALUES
  ('eletricista', 'instalacao-de-chuveiro', 'Instalação de chuveiro', ARRAY['trocar chuveiro','chuveiro elétrico','resistência de chuveiro']::text[], 0, true),
  ('eletricista', 'instalacao-de-ventilador-de-teto', 'Instalação de ventilador de teto', ARRAY['ventilador']::text[], 1, true),
  ('eletricista', 'troca-de-tomadas-e-interruptores', 'Troca de tomadas e interruptores', ARRAY['tomada','interruptor']::text[], 2, true),
  ('eletricista', 'instalacao-de-luminarias-e-iluminacao', 'Instalação de luminárias e iluminação', ARRAY['lustre','spot','fita de led','iluminação']::text[], 3, true),
  ('eletricista', 'instalacao-ou-troca-de-quadro-de-luz', 'Instalação ou troca de quadro de luz', ARRAY['quadro de distribuição','disjuntor','dr']::text[], 4, true),
  ('eletricista', 'fiacao-nova-e-passagem-de-cabos', 'Fiação nova e passagem de cabos', ARRAY['rede elétrica','passar fio']::text[], 5, true),
  ('eletricista', 'curto-circuito-ou-falta-de-energia', 'Curto-circuito ou falta de energia', ARRAY['sem luz','disjuntor caindo','choque']::text[], 6, true),
  ('eletricista', 'aterramento', 'Aterramento', ARRAY['fio terra']::text[], 7, true),
  ('eletricista', 'instalacao-de-tomada-para-ar-condicionado-ou-forno', 'Instalação de tomada para ar-condicionado ou forno', ARRAY['tomada 220']::text[], 8, true),
  ('eletricista', 'instalacao-de-portao-eletronico-ou-interfone', 'Instalação de portão eletrônico ou interfone', ARRAY['interfone','motor de portão']::text[], 9, true),
  ('eletricista', 'instalacao-eletrica-de-obra-nova', 'Instalação elétrica de obra nova', ARRAY['projeto elétrico','ligação provisória']::text[], 10, true),
  ('encanador', 'vazamento', 'Vazamento', ARRAY['cano furado','infiltração hidráulica']::text[], 0, true),
  ('encanador', 'desentupimento-de-pia-ralo-ou-vaso', 'Desentupimento de pia, ralo ou vaso', ARRAY['desentupidor','entupimento']::text[], 1, true),
  ('encanador', 'instalacao-de-torneira-ou-misturador', 'Instalação de torneira ou misturador', ARRAY['torneira']::text[], 2, true),
  ('encanador', 'troca-de-registro', 'Troca de registro', ARRAY['registro']::text[], 3, true),
  ('encanador', 'instalacao-de-vaso-sanitario', 'Instalação de vaso sanitário', ARRAY['privada','bacia sanitária','vaso']::text[], 4, true),
  ('encanador', 'instalacao-de-pia-tanque-ou-cuba', 'Instalação de pia, tanque ou cuba', ARRAY['pia','tanque']::text[], 5, true),
  ('encanador', 'instalacao-e-limpeza-de-caixa-d-agua', 'Instalação e limpeza de caixa d''água', ARRAY['caixa d''agua','limpeza de caixa']::text[], 6, true),
  ('encanador', 'instalacao-de-aquecedor', 'Instalação de aquecedor', ARRAY['aquecedor a gás','boiler']::text[], 7, true),
  ('encanador', 'instalacao-de-maquina-de-lavar', 'Instalação de máquina de lavar', ARRAY['ponto de água']::text[], 8, true),
  ('encanador', 'rede-de-agua-e-esgoto-de-obra', 'Rede de água e esgoto de obra', ARRAY['tubulação','esgoto']::text[], 9, true),
  ('pedreiro', 'reforma-de-banheiro', 'Reforma de banheiro', ARRAY['banheiro']::text[], 0, true),
  ('pedreiro', 'reforma-de-cozinha', 'Reforma de cozinha', ARRAY['cozinha']::text[], 1, true),
  ('pedreiro', 'construcao-de-muro', 'Construção de muro', ARRAY['muro']::text[], 2, true),
  ('pedreiro', 'levantar-paredes-de-alvenaria', 'Levantar paredes de alvenaria', ARRAY['parede','tijolo','bloco']::text[], 3, true),
  ('pedreiro', 'reboco-e-emboco', 'Reboco e emboço', ARRAY['reboco','chapisco']::text[], 4, true),
  ('pedreiro', 'contrapiso-e-regularizacao', 'Contrapiso e regularização', ARRAY['contrapiso','nivelamento']::text[], 5, true),
  ('pedreiro', 'laje', 'Laje', ARRAY['concretagem de laje']::text[], 6, true),
  ('pedreiro', 'fundacao-e-baldrame', 'Fundação e baldrame', ARRAY['alicerce','sapata']::text[], 7, true),
  ('pedreiro', 'calcada-e-piso-externo', 'Calçada e piso externo', ARRAY['calçada','quintal']::text[], 8, true),
  ('pedreiro', 'demolicao', 'Demolição', ARRAY['quebrar parede']::text[], 9, true),
  ('pedreiro', 'ampliacao-e-puxadinho', 'Ampliação e puxadinho', ARRAY['puxadinho','edícula']::text[], 10, true),
  ('pintor', 'pintura-de-parede-interna', 'Pintura de parede interna', ARRAY['pintar quarto','pintar sala']::text[], 0, true),
  ('pintor', 'pintura-de-fachada-e-muro', 'Pintura de fachada e muro', ARRAY['fachada','pintar muro']::text[], 1, true),
  ('pintor', 'massa-corrida-e-lixamento', 'Massa corrida e lixamento', ARRAY['massa corrida','lixar parede']::text[], 2, true),
  ('pintor', 'textura-e-grafiato', 'Textura e grafiato', ARRAY['textura','grafiato']::text[], 3, true),
  ('pintor', 'pintura-de-portas-janelas-e-grades', 'Pintura de portas, janelas e grades', ARRAY['pintar portão','esmalte']::text[], 4, true),
  ('pintor', 'pintura-de-teto-e-forro', 'Pintura de teto e forro', ARRAY['teto']::text[], 5, true),
  ('pintor', 'aplicacao-de-papel-de-parede', 'Aplicação de papel de parede', ARRAY['papel de parede']::text[], 6, true),
  ('pintor', 'verniz-e-restauracao-de-madeira', 'Verniz e restauração de madeira', ARRAY['verniz','stain']::text[], 7, true),
  ('gesseiro-e-drywall', 'forro-de-gesso', 'Forro de gesso', ARRAY['rebaixamento']::text[], 0, true),
  ('gesseiro-e-drywall', 'sanca-e-moldura-de-gesso', 'Sanca e moldura de gesso', ARRAY['sanca','moldura']::text[], 1, true),
  ('gesseiro-e-drywall', 'parede-de-drywall', 'Parede de drywall', ARRAY['divisória','parede de gesso']::text[], 2, true),
  ('gesseiro-e-drywall', 'revestimento-de-gesso', 'Revestimento de gesso', ARRAY['gesso liso']::text[], 3, true),
  ('gesseiro-e-drywall', 'reparo-de-gesso', 'Reparo de gesso', ARRAY['conserto de forro']::text[], 4, true),
  ('azulejista-e-ladrilheiro', 'assentamento-de-piso-ceramico-ou-porcelanato', 'Assentamento de piso cerâmico ou porcelanato', ARRAY['porcelanato','piso']::text[], 0, true),
  ('azulejista-e-ladrilheiro', 'assentamento-de-azulejo', 'Assentamento de azulejo', ARRAY['azulejo','revestimento de parede']::text[], 1, true),
  ('azulejista-e-ladrilheiro', 'rejunte', 'Rejunte', ARRAY['rejuntar']::text[], 2, true),
  ('azulejista-e-ladrilheiro', 'troca-de-piso-quebrado', 'Troca de piso quebrado', ARRAY['trocar cerâmica']::text[], 3, true),
  ('azulejista-e-ladrilheiro', 'assentamento-de-pedra-e-granito', 'Assentamento de pedra e granito', ARRAY['granito','mármore']::text[], 4, true),
  ('azulejista-e-ladrilheiro', 'instalacao-de-piso-laminado-ou-vinilico', 'Instalação de piso laminado ou vinílico', ARRAY['piso laminado','piso vinílico','rodapé']::text[], 5, true),
  ('serralheiro', 'portao-de-ferro-ou-aluminio', 'Portão de ferro ou alumínio', ARRAY['portão']::text[], 0, true),
  ('serralheiro', 'grade-e-protecao-de-janela', 'Grade e proteção de janela', ARRAY['grade']::text[], 1, true),
  ('serralheiro', 'corrimao-e-guarda-corpo', 'Corrimão e guarda-corpo', ARRAY['corrimão']::text[], 2, true),
  ('serralheiro', 'estrutura-metalica-e-cobertura', 'Estrutura metálica e cobertura', ARRAY['estrutura metálica','pergolado']::text[], 3, true),
  ('serralheiro', 'conserto-de-fechadura-e-dobradica', 'Conserto de fechadura e dobradiça', ARRAY['fechadura','chaveiro']::text[], 4, true),
  ('serralheiro', 'solda-em-geral', 'Solda em geral', ARRAY['solda']::text[], 5, true),
  ('marceneiro', 'moveis-sob-medida', 'Móveis sob medida', ARRAY['guarda-roupa','armário planejado']::text[], 0, true),
  ('marceneiro', 'armario-de-cozinha', 'Armário de cozinha', ARRAY['armário de cozinha']::text[], 1, true),
  ('marceneiro', 'porta-e-janela-de-madeira', 'Porta e janela de madeira', ARRAY['porta','janela']::text[], 2, true),
  ('marceneiro', 'reparo-e-restauracao-de-moveis', 'Reparo e restauração de móveis', ARRAY['consertar móvel','restaurar']::text[], 3, true),
  ('marceneiro', 'deck-e-pergolado-de-madeira', 'Deck e pergolado de madeira', ARRAY['deck']::text[], 4, true),
  ('marceneiro', 'telhado-de-madeira', 'Telhado de madeira', ARRAY['madeiramento','estrutura de telhado']::text[], 5, true),
  ('vidraceiro', 'box-de-banheiro', 'Box de banheiro', ARRAY['box']::text[], 0, true),
  ('vidraceiro', 'troca-de-vidro-quebrado', 'Troca de vidro quebrado', ARRAY['vidro quebrado']::text[], 1, true),
  ('vidraceiro', 'espelho', 'Espelho', ARRAY['espelho']::text[], 2, true),
  ('vidraceiro', 'janela-e-porta-de-vidro-ou-aluminio', 'Janela e porta de vidro ou alumínio', ARRAY['esquadria']::text[], 3, true),
  ('vidraceiro', 'guarda-corpo-de-vidro', 'Guarda-corpo de vidro', ARRAY['guarda-corpo']::text[], 4, true),
  ('vidraceiro', 'divisoria-e-fechamento-de-varanda', 'Divisória e fechamento de varanda', ARRAY['varanda']::text[], 5, true),
  ('telhadista', 'reparo-de-goteira-e-infiltracao-no-telhado', 'Reparo de goteira e infiltração no telhado', ARRAY['goteira']::text[], 0, true),
  ('telhadista', 'troca-de-telhas', 'Troca de telhas', ARRAY['telha quebrada']::text[], 1, true),
  ('telhadista', 'telhado-novo', 'Telhado novo', ARRAY['cobertura','telhado completo']::text[], 2, true),
  ('telhadista', 'calhas-e-rufos', 'Calhas e rufos', ARRAY['calha','rufo']::text[], 3, true),
  ('telhadista', 'instalacao-de-telha-termica-ou-metalica', 'Instalação de telha térmica ou metálica', ARRAY['telha térmica','telha metálica']::text[], 4, true),
  ('impermeabilizador', 'impermeabilizacao-de-laje', 'Impermeabilização de laje', ARRAY['laje']::text[], 0, true),
  ('impermeabilizador', 'impermeabilizacao-de-banheiro-e-area-molhada', 'Impermeabilização de banheiro e área molhada', ARRAY['banheiro']::text[], 1, true),
  ('impermeabilizador', 'tratamento-de-infiltracao-e-mofo', 'Tratamento de infiltração e mofo', ARRAY['mofo','umidade']::text[], 2, true),
  ('impermeabilizador', 'impermeabilizacao-de-caixa-d-agua-e-piscina', 'Impermeabilização de caixa d''água e piscina', ARRAY['piscina','reservatório']::text[], 3, true),
  ('impermeabilizador', 'manta-asfaltica', 'Manta asfáltica', ARRAY['manta']::text[], 4, true),
  ('instalador-de-ar-condicionado', 'instalacao-de-ar-condicionado-split', 'Instalação de ar-condicionado split', ARRAY['instalar split']::text[], 0, true),
  ('instalador-de-ar-condicionado', 'limpeza-e-manutencao-de-ar-condicionado', 'Limpeza e manutenção de ar-condicionado', ARRAY['higienização','limpeza de ar']::text[], 1, true),
  ('instalador-de-ar-condicionado', 'carga-de-gas-e-conserto', 'Carga de gás e conserto', ARRAY['gás','reparo']::text[], 2, true),
  ('instalador-de-ar-condicionado', 'remocao-e-troca-de-aparelho', 'Remoção e troca de aparelho', ARRAY['desinstalar']::text[], 3, true),
  ('servente-e-ajudante-de-obra', 'ajudante-de-pedreiro', 'Ajudante de pedreiro', ARRAY['ajudante de pedreiro']::text[], 0, true),
  ('servente-e-ajudante-de-obra', 'carregamento-de-material', 'Carregamento de material', ARRAY['carregar areia','carregar cimento']::text[], 1, true),
  ('servente-e-ajudante-de-obra', 'limpeza-de-obra', 'Limpeza de obra', ARRAY['limpeza pós-obra']::text[], 2, true),
  ('servente-e-ajudante-de-obra', 'remocao-de-entulho', 'Remoção de entulho', ARRAY['caçamba','entulho']::text[], 3, true),
  ('servente-e-ajudante-de-obra', 'preparo-de-massa-e-concreto', 'Preparo de massa e concreto', ARRAY['betoneira','massa']::text[], 4, true),
  ('mestre-de-obras-e-empreiteiro', 'reforma-completa-de-casa-ou-apartamento', 'Reforma completa de casa ou apartamento', ARRAY['reforma geral']::text[], 0, true),
  ('mestre-de-obras-e-empreiteiro', 'construcao-de-casa', 'Construção de casa', ARRAY['casa nova','obra nova']::text[], 1, true),
  ('mestre-de-obras-e-empreiteiro', 'gerenciamento-e-acompanhamento-de-obra', 'Gerenciamento e acompanhamento de obra', ARRAY['fiscalização']::text[], 2, true),
  ('mestre-de-obras-e-empreiteiro', 'orcamento-e-medicao-de-obra', 'Orçamento e medição de obra', ARRAY['orçamento']::text[], 3, true),
  ('instalador-de-piso-e-revestimento-de-madeira', 'raspagem-e-resina-de-taco', 'Raspagem e resina de taco', ARRAY['sinteco','resina']::text[], 0, true),
  ('instalador-de-piso-e-revestimento-de-madeira', 'instalacao-de-assoalho-de-madeira', 'Instalação de assoalho de madeira', ARRAY['assoalho']::text[], 1, true),
  ('instalador-de-piso-e-revestimento-de-madeira', 'instalacao-de-rodape-e-soleira', 'Instalação de rodapé e soleira', ARRAY['soleira']::text[], 2, true),
  ('diarista', 'faxina-completa', 'Faxina completa', '{}'::text[], 0, true),
  ('diarista', 'faxina-de-manutencao', 'Faxina de manutenção', '{}'::text[], 1, true),
  ('diarista', 'limpeza-de-cozinha-e-banheiro', 'Limpeza de cozinha e banheiro', '{}'::text[], 2, true),
  ('diarista', 'passar-roupa', 'Passar roupa', '{}'::text[], 3, true),
  ('diarista', 'organizacao-de-armarios-e-despensa', 'Organização de armários e despensa', '{}'::text[], 4, true),
  ('limpeza-pos-obra', 'limpeza-fina-pos-obra', 'Limpeza fina pós-obra', '{}'::text[], 0, true),
  ('limpeza-pos-obra', 'remocao-de-residuos-e-respingos-de-tinta', 'Remoção de resíduos e respingos de tinta', '{}'::text[], 1, true),
  ('limpeza-pos-obra', 'limpeza-de-vidros-e-esquadrias', 'Limpeza de vidros e esquadrias', '{}'::text[], 2, true),
  ('limpador-de-estofados-e-tapetes', 'lavagem-de-sofa', 'Lavagem de sofá', '{}'::text[], 0, true),
  ('limpador-de-estofados-e-tapetes', 'lavagem-de-colchao', 'Lavagem de colchão', '{}'::text[], 1, true),
  ('limpador-de-estofados-e-tapetes', 'lavagem-de-tapete', 'Lavagem de tapete', '{}'::text[], 2, true),
  ('limpador-de-estofados-e-tapetes', 'lavagem-de-carpete', 'Lavagem de carpete', '{}'::text[], 3, true),
  ('zelador-e-porteiro', 'zeladoria-de-condominio', 'Zeladoria de condomínio', '{}'::text[], 0, true),
  ('zelador-e-porteiro', 'portaria', 'Portaria', '{}'::text[], 1, true),
  ('zelador-e-porteiro', 'cobertura-de-folga', 'Cobertura de folga', '{}'::text[], 2, true),
  ('jardineiro', 'corte-de-grama', 'Corte de grama', '{}'::text[], 0, true),
  ('jardineiro', 'poda-de-arvores-e-arbustos', 'Poda de árvores e arbustos', '{}'::text[], 1, true),
  ('jardineiro', 'plantio-e-manutencao-de-jardim', 'Plantio e manutenção de jardim', '{}'::text[], 2, true),
  ('jardineiro', 'limpeza-de-terreno', 'Limpeza de terreno', '{}'::text[], 3, true),
  ('jardineiro', 'instalacao-de-grama', 'Instalação de grama', '{}'::text[], 4, true),
  ('piscineiro', 'limpeza-de-piscina', 'Limpeza de piscina', '{}'::text[], 0, true),
  ('piscineiro', 'tratamento-da-agua', 'Tratamento da água', '{}'::text[], 1, true),
  ('piscineiro', 'conserto-de-bomba-e-filtro', 'Conserto de bomba e filtro', '{}'::text[], 2, true),
  ('piscineiro', 'troca-de-areia-do-filtro', 'Troca de areia do filtro', '{}'::text[], 3, true),
  ('cabeleireiro-a', 'corte-feminino', 'Corte feminino', '{}'::text[], 0, true),
  ('cabeleireiro-a', 'corte-masculino', 'Corte masculino', '{}'::text[], 1, true),
  ('cabeleireiro-a', 'coloracao', 'Coloração', '{}'::text[], 2, true),
  ('cabeleireiro-a', 'escova-e-penteado', 'Escova e penteado', '{}'::text[], 3, true),
  ('cabeleireiro-a', 'alisamento-e-progressiva', 'Alisamento e progressiva', '{}'::text[], 4, true),
  ('cabeleireiro-a', 'hidratacao-e-tratamento', 'Hidratação e tratamento', '{}'::text[], 5, true),
  ('barbeiro', 'corte-masculino', 'Corte masculino', '{}'::text[], 0, true),
  ('barbeiro', 'barba', 'Barba', '{}'::text[], 1, true),
  ('barbeiro', 'corte-e-barba', 'Corte e barba', '{}'::text[], 2, true),
  ('barbeiro', 'pigmentacao', 'Pigmentação', '{}'::text[], 3, true),
  ('manicure-e-pedicure', 'manicure', 'Manicure', '{}'::text[], 0, true),
  ('manicure-e-pedicure', 'pedicure', 'Pedicure', '{}'::text[], 1, true),
  ('manicure-e-pedicure', 'alongamento-de-unhas', 'Alongamento de unhas', '{}'::text[], 2, true),
  ('manicure-e-pedicure', 'esmaltacao-em-gel', 'Esmaltação em gel', '{}'::text[], 3, true),
  ('maquiador-a', 'maquiagem-social', 'Maquiagem social', '{}'::text[], 0, true),
  ('maquiador-a', 'maquiagem-de-noiva', 'Maquiagem de noiva', '{}'::text[], 1, true),
  ('maquiador-a', 'automaquiagem-aula', 'Automaquiagem (aula)', '{}'::text[], 2, true),
  ('designer-de-sobrancelhas', 'design-de-sobrancelhas', 'Design de sobrancelhas', '{}'::text[], 0, true),
  ('designer-de-sobrancelhas', 'henna', 'Henna', '{}'::text[], 1, true),
  ('designer-de-sobrancelhas', 'extensao-de-cilios', 'Extensão de cílios', '{}'::text[], 2, true),
  ('depilador-a', 'depilacao-com-cera', 'Depilação com cera', '{}'::text[], 0, true),
  ('depilador-a', 'depilacao-a-laser', 'Depilação a laser', '{}'::text[], 1, true),
  ('optometrista', 'exame-de-vista', 'Exame de vista', '{}'::text[], 0, true),
  ('optometrista', 'adaptacao-de-lentes-de-contato', 'Adaptação de lentes de contato', '{}'::text[], 1, true),
  ('optometrista', 'atendimento-em-optica', 'Atendimento em óptica', '{}'::text[], 2, true),
  ('tecnico-de-enfermagem', 'curativos', 'Curativos', '{}'::text[], 0, true),
  ('tecnico-de-enfermagem', 'aplicacao-de-medicacao', 'Aplicação de medicação', '{}'::text[], 1, true),
  ('tecnico-de-enfermagem', 'acompanhamento-hospitalar', 'Acompanhamento hospitalar', '{}'::text[], 2, true),
  ('tecnico-de-enfermagem', 'plantao-domiciliar', 'Plantão domiciliar', '{}'::text[], 3, true),
  ('massoterapeuta', 'massagem-relaxante', 'Massagem relaxante', '{}'::text[], 0, true),
  ('massoterapeuta', 'massagem-terapeutica', 'Massagem terapêutica', '{}'::text[], 1, true),
  ('massoterapeuta', 'quick-massage-em-empresa', 'Quick massage em empresa', '{}'::text[], 2, true),
  ('fisioterapeuta', 'fisioterapia-domiciliar', 'Fisioterapia domiciliar', '{}'::text[], 0, true),
  ('fisioterapeuta', 'reabilitacao', 'Reabilitação', '{}'::text[], 1, true),
  ('fisioterapeuta', 'pilates-clinico', 'Pilates clínico', '{}'::text[], 2, true),
  ('personal-trainer', 'treino-em-casa', 'Treino em casa', '{}'::text[], 0, true),
  ('personal-trainer', 'treino-em-academia', 'Treino em academia', '{}'::text[], 1, true),
  ('personal-trainer', 'treino-ao-ar-livre', 'Treino ao ar livre', '{}'::text[], 2, true),
  ('cuidador-a-de-idosos', 'cuidador-diurno', 'Cuidador diurno', '{}'::text[], 0, true),
  ('cuidador-a-de-idosos', 'cuidador-noturno', 'Cuidador noturno', '{}'::text[], 1, true),
  ('cuidador-a-de-idosos', 'acompanhamento-em-consultas', 'Acompanhamento em consultas', '{}'::text[], 2, true),
  ('baba', 'baba-diurna', 'Babá diurna', '{}'::text[], 0, true),
  ('baba', 'baba-noturna', 'Babá noturna', '{}'::text[], 1, true),
  ('baba', 'buscar-na-escola', 'Buscar na escola', '{}'::text[], 2, true),
  ('passeador-e-cuidador-de-pets', 'passeio-com-cachorro', 'Passeio com cachorro', '{}'::text[], 0, true),
  ('passeador-e-cuidador-de-pets', 'hospedagem-de-pet', 'Hospedagem de pet', '{}'::text[], 1, true),
  ('passeador-e-cuidador-de-pets', 'banho-e-tosa', 'Banho e tosa', '{}'::text[], 2, true),
  ('freteiro-e-motorista-de-mudanca', 'mudanca-residencial', 'Mudança residencial', '{}'::text[], 0, true),
  ('freteiro-e-motorista-de-mudanca', 'frete-pequeno', 'Frete pequeno', '{}'::text[], 1, true),
  ('freteiro-e-motorista-de-mudanca', 'transporte-de-moveis', 'Transporte de móveis', '{}'::text[], 2, true),
  ('freteiro-e-motorista-de-mudanca', 'transporte-de-material-de-obra', 'Transporte de material de obra', '{}'::text[], 3, true),
  ('ajudante-de-mudanca', 'carregar-e-descarregar', 'Carregar e descarregar', '{}'::text[], 0, true),
  ('ajudante-de-mudanca', 'embalar-e-desmontar-moveis', 'Embalar e desmontar móveis', '{}'::text[], 1, true),
  ('montador-de-moveis', 'montagem-de-guarda-roupa', 'Montagem de guarda-roupa', '{}'::text[], 0, true),
  ('montador-de-moveis', 'montagem-de-cozinha', 'Montagem de cozinha', '{}'::text[], 1, true),
  ('montador-de-moveis', 'montagem-de-cama-e-estante', 'Montagem de cama e estante', '{}'::text[], 2, true),
  ('montador-de-moveis', 'desmontagem-de-moveis', 'Desmontagem de móveis', '{}'::text[], 3, true),
  ('motoboy-e-entregador', 'entrega-expressa', 'Entrega expressa', '{}'::text[], 0, true),
  ('motoboy-e-entregador', 'entrega-de-documentos', 'Entrega de documentos', '{}'::text[], 1, true),
  ('motoboy-e-entregador', 'entrega-de-refeicoes', 'Entrega de refeições', '{}'::text[], 2, true),
  ('motoboy-e-entregador', 'retirada-de-encomendas', 'Retirada de encomendas', '{}'::text[], 3, true),
  ('tecnico-de-informatica', 'formatacao-e-instalacao', 'Formatação e instalação', '{}'::text[], 0, true),
  ('tecnico-de-informatica', 'remocao-de-virus', 'Remoção de vírus', '{}'::text[], 1, true),
  ('tecnico-de-informatica', 'troca-de-pecas', 'Troca de peças', '{}'::text[], 2, true),
  ('tecnico-de-informatica', 'configuracao-de-rede-e-wi-fi', 'Configuração de rede e Wi-Fi', '{}'::text[], 3, true),
  ('tecnico-de-celular', 'troca-de-tela', 'Troca de tela', '{}'::text[], 0, true),
  ('tecnico-de-celular', 'troca-de-bateria', 'Troca de bateria', '{}'::text[], 1, true),
  ('tecnico-de-celular', 'desbloqueio-e-configuracao', 'Desbloqueio e configuração', '{}'::text[], 2, true),
  ('tecnico-de-eletrodomesticos', 'conserto-de-geladeira', 'Conserto de geladeira', '{}'::text[], 0, true),
  ('tecnico-de-eletrodomesticos', 'conserto-de-maquina-de-lavar', 'Conserto de máquina de lavar', '{}'::text[], 1, true),
  ('tecnico-de-eletrodomesticos', 'conserto-de-fogao-e-forno', 'Conserto de fogão e forno', '{}'::text[], 2, true),
  ('tecnico-de-eletrodomesticos', 'conserto-de-micro-ondas', 'Conserto de micro-ondas', '{}'::text[], 3, true),
  ('instalador-de-cameras-e-alarmes', 'instalacao-de-cameras', 'Instalação de câmeras', '{}'::text[], 0, true),
  ('instalador-de-cameras-e-alarmes', 'instalacao-de-alarme', 'Instalação de alarme', '{}'::text[], 1, true),
  ('instalador-de-cameras-e-alarmes', 'instalacao-de-cerca-eletrica', 'Instalação de cerca elétrica', '{}'::text[], 2, true),
  ('instalador-de-cameras-e-alarmes', 'instalacao-de-antena-e-tv', 'Instalação de antena e TV', '{}'::text[], 3, true),
  ('garcom-e-copeiro', 'garcom-para-evento', 'Garçom para evento', '{}'::text[], 0, true),
  ('garcom-e-copeiro', 'copeira', 'Copeira', '{}'::text[], 1, true),
  ('garcom-e-copeiro', 'barman', 'Barman', '{}'::text[], 2, true),
  ('cozinheiro-a', 'cozinheiro-para-evento', 'Cozinheiro para evento', '{}'::text[], 0, true),
  ('cozinheiro-a', 'marmitas', 'Marmitas', '{}'::text[], 1, true),
  ('cozinheiro-a', 'comida-caseira-por-encomenda', 'Comida caseira por encomenda', '{}'::text[], 2, true),
  ('churrasqueiro', 'churrasco-para-evento', 'Churrasco para evento', '{}'::text[], 0, true),
  ('churrasqueiro', 'churrasco-em-casa', 'Churrasco em casa', '{}'::text[], 1, true),
  ('confeiteiro-a', 'bolo-de-festa', 'Bolo de festa', '{}'::text[], 0, true),
  ('confeiteiro-a', 'doces-para-festa', 'Doces para festa', '{}'::text[], 1, true),
  ('confeiteiro-a', 'salgados-para-festa', 'Salgados para festa', '{}'::text[], 2, true),
  ('dj-e-som', 'dj-para-festa', 'DJ para festa', '{}'::text[], 0, true),
  ('dj-e-som', 'aluguel-de-som', 'Aluguel de som', '{}'::text[], 1, true),
  ('fotografo-a', 'fotografia-de-evento', 'Fotografia de evento', '{}'::text[], 0, true),
  ('fotografo-a', 'ensaio-fotografico', 'Ensaio fotográfico', '{}'::text[], 1, true),
  ('fotografo-a', 'filmagem', 'Filmagem', '{}'::text[], 2, true),
  ('mecanico', 'revisao-e-troca-de-oleo', 'Revisão e troca de óleo', '{}'::text[], 0, true),
  ('mecanico', 'freios', 'Freios', '{}'::text[], 1, true),
  ('mecanico', 'suspensao', 'Suspensão', '{}'::text[], 2, true),
  ('mecanico', 'motor', 'Motor', '{}'::text[], 3, true),
  ('mecanico', 'mecanico-a-domicilio', 'Mecânico a domicílio', '{}'::text[], 4, true),
  ('eletricista-automotivo', 'bateria-e-alternador', 'Bateria e alternador', '{}'::text[], 0, true),
  ('eletricista-automotivo', 'som-e-acessorios', 'Som e acessórios', '{}'::text[], 1, true),
  ('eletricista-automotivo', 'farois-e-lanternas', 'Faróis e lanternas', '{}'::text[], 2, true),
  ('funileiro-e-pintor-automotivo', 'reparo-de-amassados', 'Reparo de amassados', '{}'::text[], 0, true),
  ('funileiro-e-pintor-automotivo', 'pintura-de-peca', 'Pintura de peça', '{}'::text[], 1, true),
  ('funileiro-e-pintor-automotivo', 'polimento-e-cristalizacao', 'Polimento e cristalização', '{}'::text[], 2, true),
  ('borracheiro', 'troca-de-pneu', 'Troca de pneu', '{}'::text[], 0, true),
  ('borracheiro', 'conserto-de-pneu-furado', 'Conserto de pneu furado', '{}'::text[], 1, true),
  ('borracheiro', 'socorro-de-pneu', 'Socorro de pneu', '{}'::text[], 2, true),
  ('lavador-de-carros', 'lavagem-simples', 'Lavagem simples', '{}'::text[], 0, true),
  ('lavador-de-carros', 'lavagem-completa-e-higienizacao', 'Lavagem completa e higienização', '{}'::text[], 1, true),
  ('lavador-de-carros', 'polimento', 'Polimento', '{}'::text[], 2, true)
) AS v(profession_slug, slug, name, aliases, sort, active) JOIN public.professions p ON p.slug = v.profession_slug
ON CONFLICT (profession_id, slug) DO UPDATE SET name = EXCLUDED.name, aliases = EXCLUDED.aliases, sort = EXCLUDED.sort, active = EXCLUDED.active;

