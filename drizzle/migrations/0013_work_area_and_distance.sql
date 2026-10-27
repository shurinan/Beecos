-- Endereço (CEP) e raio de atuação: onde a pessoa trabalha e onde fica cada vaga.
-- Depende de 0001 (subscriptions, is_premium) e 0012 (catálogo; usado nos avisos por profissão).
-- Os avisos em si vêm depois; aqui ficam os dados e a distância.

-- Distância em linha reta (km) entre dois pontos.
CREATE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371 * 2 * asin(sqrt(least(1, power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))
$$;

-- Raio de aviso de todos os planos. Premium pode somar um raio expandido.
CREATE FUNCTION public.base_radius_km() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 20 $$;

-- Coordenadas só do Brasil e sempre aproximadas (2 casas decimais, cerca de 1 km): ninguém guarda o ponto exato.
CREATE FUNCTION public.round_geo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.lat IS NULL) <> (NEW.lng IS NULL) THEN
    RAISE EXCEPTION 'Informe latitude e longitude juntas' USING ERRCODE = '23514';
  END IF;
  IF NEW.lat IS NOT NULL THEN
    IF NEW.lat NOT BETWEEN -34 AND 6 OR NEW.lng NOT BETWEEN -75 AND -33 THEN
      RAISE EXCEPTION 'Localização fora do Brasil' USING ERRCODE = '23514';
    END IF;
    NEW.lat := round(NEW.lat::numeric, 2);
    NEW.lng := round(NEW.lng::numeric, 2);
  END IF;
  RETURN NEW;
END $$;

-- Onde a pessoa atua. Só ela lê e altera; os outros veem apenas a distância, calculada pelo banco.
CREATE TABLE public.work_areas (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{8}$'),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 80),
  state text NOT NULL DEFAULT '' CHECK (char_length(state) <= 2),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  -- km somados aos 20 do plano grátis. Só Premium.
  expanded_km smallint NOT NULL DEFAULT 0 CHECK (expanded_km IN (0, 5, 10, 20, 30)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.work_areas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_areas TO authenticated;
GRANT ALL ON public.work_areas TO service_role;
ALTER TABLE public.work_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own work area read" ON public.work_areas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own work area insert" ON public.work_areas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own work area update" ON public.work_areas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own work area delete" ON public.work_areas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER work_areas_geo BEFORE INSERT OR UPDATE ON public.work_areas
  FOR EACH ROW EXECUTE FUNCTION public.round_geo();
CREATE TRIGGER work_areas_touch BEFORE UPDATE ON public.work_areas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Raio expandido é Premium. Quem já tinha e perdeu o plano mantém o valor guardado (ele só deixa de valer).
CREATE FUNCTION public.guard_work_area() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.expanded_km > 0
     AND (TG_OP = 'INSERT' OR OLD.expanded_km IS DISTINCT FROM NEW.expanded_km)
     AND NOT public.is_premium(NEW.user_id) THEN
    RAISE EXCEPTION 'RAIO_PREMIUM' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER work_areas_premium BEFORE INSERT OR UPDATE ON public.work_areas
  FOR EACH ROW EXECUTE FUNCTION public.guard_work_area();

-- Raio que vale hoje para um usuário: 20 km, mais a expansão se o Premium está ativo.
CREATE FUNCTION public.effective_radius_km(_user_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.base_radius_km()
    + CASE WHEN public.is_premium(_user_id) THEN coalesce((SELECT expanded_km FROM public.work_areas WHERE user_id = _user_id), 0) ELSE 0 END
$$;

CREATE FUNCTION public.my_work_radius_km() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.effective_radius_km(auth.uid()) END
$$;

-- Vagas e anúncios: CEP e ponto aproximado (a cidade já era pública).
ALTER TABLE public.posts
  ADD COLUMN postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{8}$'),
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision;
CREATE TRIGGER posts_geo BEFORE INSERT OR UPDATE OF lat, lng ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.round_geo();

-- Distância de cada vaga até quem está logado, e se está além do raio dele (aviso "pode ser longe").
CREATE FUNCTION public.my_post_distances(_post_ids uuid[])
RETURNS TABLE (post_id uuid, km numeric, notify_km integer, far boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         round(public.haversine_km(w.lat, w.lng, p.lat, p.lng)::numeric, 1),
         r.km,
         public.haversine_km(w.lat, w.lng, p.lat, p.lng) > r.km
  FROM public.work_areas w
  CROSS JOIN LATERAL (SELECT public.effective_radius_km(w.user_id) AS km) r
  JOIN public.posts p ON p.id = ANY (_post_ids) AND p.lat IS NOT NULL
  WHERE w.user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.my_post_distances(uuid[]), public.my_work_radius_km() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_post_distances(uuid[]), public.my_work_radius_km() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.effective_radius_km(uuid), public.guard_work_area(), public.round_geo() FROM PUBLIC, anon, authenticated;
