-- Informações pessoais de contato: e-mail (da conta), telefones por tipo e endereços.
-- Tudo privado: só o dono lê e escreve. Nada disso aparece no perfil público.
-- Depende da 0003 (profile_private).

-- 1. Telefones (celular, residencial, trabalho/fax), com os meios de contato aceitos
CREATE TABLE public.contact_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mobile', 'home', 'work')),
  number text NOT NULL CHECK (char_length(number) BETWEEN 8 AND 30),
  methods text[] NOT NULL DEFAULT ARRAY['call']
    CHECK (cardinality(methods) >= 1 AND methods <@ ARRAY['call', 'sms', 'whatsapp']),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_phones TO authenticated;
GRANT ALL ON public.contact_phones TO service_role;
REVOKE ALL ON public.contact_phones FROM anon;
ALTER TABLE public.contact_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phones read" ON public.contact_phones FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own phones insert" ON public.contact_phones FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own phones update" ON public.contact_phones FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own phones delete" ON public.contact_phones FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_phone_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.contact_phones WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'LIMITE_TELEFONES';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contact_phones_limit BEFORE INSERT ON public.contact_phones
FOR EACH ROW EXECUTE FUNCTION public.enforce_phone_limit();

-- O telefone que ficava em profile_private vira um celular em contact_phones.
INSERT INTO public.contact_phones (user_id, kind, number)
SELECT user_id, 'mobile', btrim(phone)
FROM public.profile_private
WHERE char_length(btrim(phone)) BETWEEN 8 AND 30
ON CONFLICT (user_id, number) DO NOTHING;

ALTER TABLE public.profile_private DROP COLUMN phone;

-- 2. Endereços: um físico e um postal por pessoa
CREATE TABLE public.contact_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('physical', 'postal')),
  recipient text NOT NULL CHECK (char_length(recipient) BETWEEN 1 AND 80),
  care_of text NOT NULL DEFAULT '' CHECK (char_length(care_of) <= 80),
  street text NOT NULL CHECK (char_length(street) BETWEEN 1 AND 120),
  neighborhood text NOT NULL DEFAULT '' CHECK (char_length(neighborhood) <= 60),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 60),
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{8}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_addresses TO authenticated;
GRANT ALL ON public.contact_addresses TO service_role;
REVOKE ALL ON public.contact_addresses FROM anon;
ALTER TABLE public.contact_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own addresses read" ON public.contact_addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own addresses insert" ON public.contact_addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own addresses update" ON public.contact_addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own addresses delete" ON public.contact_addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER contact_addresses_touch BEFORE UPDATE ON public.contact_addresses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
