-- A moderação vê o endereço cadastrado só para comparar com o comprovante, e cada consulta fica registrada.
-- Depende de 0030 (moderator_access_log) e 0041.
CREATE FUNCTION public.verification_address(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.identity_verifications; a public.contact_addresses;
BEGIN
  IF NOT public.is_moderator() THEN RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v FROM public.identity_verifications WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'JA_ANALISADA'; END IF;
  SELECT * INTO a FROM public.contact_addresses WHERE user_id = v.user_id AND kind = 'physical';
  INSERT INTO public.moderator_access_log (moderator_id, report_id, what)
    VALUES (auth.uid(), _id, 'viu o endereço cadastrado (verificação)');
  IF NOT FOUND OR a.user_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('street', a.street, 'neighborhood', a.neighborhood, 'city', a.city,
                            'state', a.state, 'postal_code', a.postal_code);
END $$;
REVOKE EXECUTE ON FUNCTION public.verification_address(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verification_address(uuid) TO authenticated;
