-- Selos: Verificado (documento aprovado) e Premium. Depende de 0001 (is_premium) e 0022 (is_moderator).
-- Documento e selfie ficam num bucket PRIVADO, só o dono e moderadores leem, e são apagados após a análise.

CREATE TABLE public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_front_path text NOT NULL,
  doc_back_path text,
  selfie_path text NOT NULL,
  address_proof_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 300),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  files_deleted_at timestamptz,
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (doc_front_path LIKE user_id::text || '/%' AND selfie_path LIKE user_id::text || '/%'
    AND (doc_back_path IS NULL OR doc_back_path LIKE user_id::text || '/%')
    AND (address_proof_path IS NULL OR address_proof_path LIKE user_id::text || '/%'))
);
CREATE UNIQUE INDEX identity_verifications_one_pending ON public.identity_verifications (user_id) WHERE status = 'pending';
CREATE INDEX identity_verifications_queue ON public.identity_verifications (status, created_at);
REVOKE ALL ON public.identity_verifications FROM anon, authenticated;
GRANT SELECT, INSERT ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verif own or mod read" ON public.identity_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator());
CREATE POLICY "verif own insert" ON public.identity_verifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL);

-- O que foi conferido de cada pessoa (só datas; nenhum dado pessoal).
CREATE TABLE public.user_checks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_at timestamptz,
  address_at timestamptz,
  phone_at timestamptz
);
REVOKE ALL ON public.user_checks FROM anon, authenticated;
GRANT SELECT ON public.user_checks TO authenticated;
GRANT ALL ON public.user_checks TO service_role;
ALTER TABLE public.user_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checks own read" ON public.user_checks FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Bucket privado, só imagens de até 5 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('identity-docs', 'identity-docs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
CREATE POLICY "identity own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'identity-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "identity own or mod read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'identity-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_moderator()));
CREATE POLICY "identity own or mod delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'identity-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_moderator()));

-- Decisão da moderação. Devolve os caminhos dos arquivos para o app apagá-los na hora.
CREATE FUNCTION public.review_verification(_id uuid, _approve boolean, _reason text DEFAULT '', _address boolean DEFAULT false)
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
    INSERT INTO public.user_checks (user_id, document_at, address_at)
      VALUES (v.user_id, now(), CASE WHEN _address AND v.address_proof_path IS NOT NULL THEN now() END)
    ON CONFLICT (user_id) DO UPDATE
      SET document_at = now(),
          address_at = CASE WHEN _address AND v.address_proof_path IS NOT NULL THEN now() ELSE public.user_checks.address_at END;
  END IF;
  RETURN array_remove(ARRAY[v.doc_front_path, v.doc_back_path, v.selfie_path, v.address_proof_path], NULL);
END $$;
REVOKE EXECUTE ON FUNCTION public.review_verification(uuid, boolean, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_verification(uuid, boolean, text, boolean) TO authenticated;

-- Confirma que os arquivos foram apagados do armazenamento.
CREATE FUNCTION public.mark_verification_files_deleted(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_moderator() THEN RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501'; END IF;
  UPDATE public.identity_verifications SET files_deleted_at = now()
    WHERE id = _id AND status <> 'pending' AND files_deleted_at IS NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_verification_files_deleted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_verification_files_deleted(uuid) TO authenticated;

-- Selos de várias pessoas de uma vez: só sim/não de cada item, nunca o dado.
CREATE FUNCTION public.badge_info(_user_ids uuid[])
RETURNS TABLE (user_id uuid, premium boolean, doc boolean, email boolean, address boolean, phone boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id,
         public.is_premium(u.id),
         coalesce(c.document_at IS NOT NULL, false),
         (a.email_confirmed_at IS NOT NULL),
         coalesce(c.address_at IS NOT NULL, false),
         coalesce(c.phone_at IS NOT NULL, false)
  FROM unnest(_user_ids[1:100]) AS u(id)
  LEFT JOIN public.user_checks c ON c.user_id = u.id
  LEFT JOIN auth.users a ON a.id = u.id
$$;
REVOKE EXECUTE ON FUNCTION public.badge_info(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.badge_info(uuid[]) TO authenticated;

-- Fila para a moderação.
CREATE FUNCTION public.pending_verifications_count() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_moderator()
    THEN (SELECT count(*)::int FROM public.identity_verifications WHERE status = 'pending') ELSE 0 END
$$;
REVOKE EXECUTE ON FUNCTION public.pending_verifications_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_verifications_count() TO authenticated;
