-- Novo espaço de anúncio na página inicial.
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_placement_check;
ALTER TABLE public.ads ADD CONSTRAINT ads_placement_check CHECK (placement IN ('home', 'feed', 'profile'));
