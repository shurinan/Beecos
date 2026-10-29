-- Cancelar a assinatura pelo perfil (o Premium segue até o fim do período pago e não renova; quem cancela
-- em até 7 dias da contratação tem o valor devolvido — o pagamento, pelo Asaas, lê este pedido).
-- E nova versão dos Termos e da Privacidade (cobrança, arrependimento, guarda de 7 dias, anexos de 48 h).
ALTER TABLE public.subscriptions ADD COLUMN cancel_requested_at timestamptz;

CREATE FUNCTION public.request_subscription_cancel() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); t timestamptz;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
  UPDATE public.subscriptions SET cancel_requested_at = coalesce(cancel_requested_at, now())
   WHERE user_id = me AND plan = 'premium'
   RETURNING cancel_requested_at INTO t;
  IF t IS NULL THEN RAISE EXCEPTION 'SEM_ASSINATURA' USING ERRCODE = '22023'; END IF;
  RETURN t;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_subscription_cancel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_subscription_cancel() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_terms_version() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-10-29' $$;
