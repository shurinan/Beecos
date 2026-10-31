-- Documentos da verificação de quem excluiu a conta: a função cleanup-chat-files (de hora em hora) apaga.
-- Se a conta estava em guarda por denúncia (audit_holds), os arquivos ficam até a guarda acabar.
CREATE OR REPLACE FUNCTION public.orphan_identity_files(_limit integer DEFAULT 200)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'identity-docs'
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = (storage.foldername(o.name))[1])
    AND NOT EXISTS (SELECT 1 FROM public.audit_holds h
                    WHERE h.user_id::text = (storage.foldername(o.name))[1] AND h.until > now())
  LIMIT greatest(1, least(_limit, 1000));
$$;
REVOKE EXECUTE ON FUNCTION public.orphan_identity_files(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orphan_identity_files(integer) TO service_role;
