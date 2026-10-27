-- O local da vaga é só para medir distância: sai da tabela pública e vai para uma tabela que só o dono lê.
-- Também protege a edição de vagas (não dá para reduzir as vagas abaixo das já ocupadas, nem trocar o tipo).
-- Depende de 0013 (round_geo, my_post_distances) e 0010 (engagements).

CREATE TABLE public.post_locations (
  post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{8}$'),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.post_locations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_locations TO authenticated;
GRANT ALL ON public.post_locations TO service_role;
ALTER TABLE public.post_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own post location read" ON public.post_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "own post location insert" ON public.post_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "own post location update" ON public.post_locations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "own post location delete" ON public.post_locations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE TRIGGER post_locations_geo BEFORE INSERT OR UPDATE ON public.post_locations
  FOR EACH ROW EXECUTE FUNCTION public.round_geo();
CREATE TRIGGER post_locations_touch BEFORE UPDATE ON public.post_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.post_locations (post_id, postal_code, lat, lng)
SELECT id, postal_code, lat, lng FROM public.posts WHERE postal_code IS NOT NULL AND lat IS NOT NULL;
DROP TRIGGER posts_geo ON public.posts;
ALTER TABLE public.posts DROP COLUMN postal_code, DROP COLUMN lat, DROP COLUMN lng;

CREATE OR REPLACE FUNCTION public.my_post_distances(_post_ids uuid[])
RETURNS TABLE (post_id uuid, km numeric, notify_km integer, far boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.post_id,
         round(public.haversine_km(w.lat, w.lng, l.lat, l.lng)::numeric, 1),
         r.km,
         public.haversine_km(w.lat, w.lng, l.lat, l.lng) > r.km
  FROM public.work_areas w
  CROSS JOIN LATERAL (SELECT public.effective_radius_km(w.user_id) AS km) r
  JOIN public.post_locations l ON l.post_id = ANY (_post_ids)
  WHERE w.user_id = auth.uid()
$$;

-- Edição da vaga: o tipo não muda, e as vagas não ficam abaixo das já ocupadas (escolhido, aceito ou concluído).
CREATE FUNCTION public.guard_post_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE taken integer;
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'TIPO_FIXO' USING ERRCODE = '23514';
  END IF;
  IF NEW.vacancies < OLD.vacancies THEN
    SELECT count(*) INTO taken FROM public.engagements e
      WHERE e.post_id = NEW.id AND e.status IN ('proposed', 'accepted', 'completed');
    IF NEW.vacancies < taken THEN
      RAISE EXCEPTION 'VAGAS_OCUPADAS' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posts_edit_guard BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_edit();
REVOKE EXECUTE ON FUNCTION public.guard_post_edit() FROM PUBLIC, anon, authenticated;
