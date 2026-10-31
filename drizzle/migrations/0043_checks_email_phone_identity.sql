-- Verificações como na OLX: E-mail, Telefone e Identidade. Endereço deixa de ser conferido.
-- Substitui funções da 0041 e remove a consulta de endereço da 0042 (menos dado pessoal em circulação).
DROP FUNCTION public.verification_address(uuid);
DROP FUNCTION public.review_verification(uuid, boolean, text, boolean);
DROP FUNCTION public.badge_info(uuid[]);

CREATE FUNCTION public.review_verification(_id uuid, _approve boolean, _reason text DEFAULT '')
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.identity_verifications;
BEGIN
  IF NOT public.is_moderator() THEN RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v FROM public.identity_verifications WHERE id = _id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JA_ANALISADA'; END IF;
  IF v.user_id = auth.uid() THEN RAISE EXCEPTION 'PROPRIO_PEDIDO'; END IF;
  IF NOT _approve AND char_length(btrim(_reason)) = 0 THEN RAISE EXCEPTION 'MOTIVO_OBRIGATORIO'; END IF;
  UPDATE public.identity_verifications
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        reason = CASE WHEN _approve THEN '' ELSE left(btrim(_reason), 300) END,
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _id;
  IF _approve THEN
    INSERT INTO public.user_checks (user_id, document_at) VALUES (v.user_id, now())
    ON CONFLICT (user_id) DO UPDATE SET document_at = now();
  END IF;
  RETURN array_remove(ARRAY[v.doc_front_path, v.doc_back_path, v.selfie_path, v.address_proof_path], NULL);
END $$;
REVOKE EXECUTE ON FUNCTION public.review_verification(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_verification(uuid, boolean, text) TO authenticated;

CREATE FUNCTION public.badge_info(_user_ids uuid[])
RETURNS TABLE (user_id uuid, premium boolean, doc boolean, email boolean, phone boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id,
         public.is_premium(u.id),
         coalesce(c.document_at IS NOT NULL, false),
         (a.email_confirmed_at IS NOT NULL),
         coalesce(c.phone_at IS NOT NULL, false)
  FROM unnest(_user_ids[1:100]) AS u(id)
  LEFT JOIN public.user_checks c ON c.user_id = u.id
  LEFT JOIN auth.users a ON a.id = u.id
$$;
REVOKE EXECUTE ON FUNCTION public.badge_info(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.badge_info(uuid[]) TO authenticated;
