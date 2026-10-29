-- Plano Premium anual: R$ 149 em pagamento único, vale 12 meses e não renova sozinho (equivale a 10 meses
-- de R$ 14,90: economia de cerca de 17%). Cobrança avulsa no Asaas, com externalReference "annual:<pessoa>".
ALTER TABLE public.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_kind_check CHECK (kind IN ('premium', 'annual', 'urgent'));
ALTER TABLE public.subscriptions ADD COLUMN plan_term text NOT NULL DEFAULT 'monthly' CHECK (plan_term IN ('monthly', 'annual'));

CREATE OR REPLACE FUNCTION public.asaas_apply_payment(
  _payment_id text, _customer text, _subscription text, _ref text, _value numeric, _status text, _url text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid;
  k text := CASE WHEN _ref LIKE 'urgent:%' THEN 'urgent' WHEN _ref LIKE 'annual:%' THEN 'annual' ELSE 'premium' END;
  pid uuid;
  r public.payments%ROWTYPE;
BEGIN
  SELECT user_id INTO uid FROM public.asaas_customers WHERE customer_id = _customer;
  IF uid IS NULL THEN RETURN 'cliente_desconhecido'; END IF;
  IF k = 'urgent' THEN
    BEGIN pid := split_part(_ref, ':', 2)::uuid; EXCEPTION WHEN others THEN pid := NULL; END;
  END IF;

  INSERT INTO public.payments (user_id, kind, post_id, asaas_payment_id, asaas_subscription_id, value, invoice_url)
  VALUES (uid, k, pid, _payment_id, _subscription, _value, _url)
  ON CONFLICT (asaas_payment_id) DO UPDATE
    SET invoice_url = coalesce(excluded.invoice_url, public.payments.invoice_url),
        asaas_subscription_id = coalesce(excluded.asaas_subscription_id, public.payments.asaas_subscription_id);

  IF _status = 'paid' THEN
    UPDATE public.payments SET status = 'paid', paid_at = now()
     WHERE asaas_payment_id = _payment_id AND status <> 'paid' RETURNING * INTO r;
    IF NOT FOUND THEN RETURN 'ja_aplicado'; END IF;
    IF r.kind = 'urgent' THEN
      IF r.post_id IS NOT NULL THEN
        UPDATE public.posts SET urgent = true WHERE id = r.post_id AND user_id = r.user_id;
      END IF;
    ELSIF r.kind = 'annual' THEN
      INSERT INTO public.subscriptions (user_id, plan, active_until, first_paid_at, plan_term)
      VALUES (uid, 'premium', now() + interval '12 months', now(), 'annual')
      ON CONFLICT (user_id) DO UPDATE SET
        plan = 'premium',
        active_until = CASE
          WHEN public.subscriptions.plan = 'premium' AND public.subscriptions.active_until IS NULL THEN NULL
          ELSE greatest(coalesce(public.subscriptions.active_until, now()), now()) + interval '12 months' END,
        first_paid_at = now(),
        plan_term = 'annual',
        cancel_requested_at = NULL;
    ELSE
      INSERT INTO public.subscriptions (user_id, plan, active_until, first_paid_at, asaas_subscription_id, plan_term)
      VALUES (uid, 'premium', now() + interval '1 month', now(), _subscription, 'monthly')
      ON CONFLICT (user_id) DO UPDATE SET
        plan = 'premium',
        active_until = CASE
          WHEN public.subscriptions.plan = 'premium' AND public.subscriptions.active_until IS NULL THEN NULL
          ELSE greatest(coalesce(public.subscriptions.active_until, now()), now()) + interval '1 month' END,
        first_paid_at = CASE
          WHEN public.subscriptions.asaas_subscription_id IS DISTINCT FROM excluded.asaas_subscription_id THEN now()
          ELSE coalesce(public.subscriptions.first_paid_at, now()) END,
        cancel_requested_at = CASE
          WHEN public.subscriptions.asaas_subscription_id IS DISTINCT FROM excluded.asaas_subscription_id THEN NULL
          ELSE public.subscriptions.cancel_requested_at END,
        plan_term = 'monthly',
        asaas_subscription_id = coalesce(excluded.asaas_subscription_id, public.subscriptions.asaas_subscription_id);
    END IF;
    RETURN 'pago';
  ELSIF _status = 'refunded' THEN
    UPDATE public.payments SET status = 'refunded', refunded_at = now()
     WHERE asaas_payment_id = _payment_id AND status <> 'refunded' RETURNING * INTO r;
    IF NOT FOUND THEN RETURN 'ja_aplicado'; END IF;
    IF r.kind = 'urgent' THEN
      IF r.post_id IS NOT NULL THEN UPDATE public.posts SET urgent = false WHERE id = r.post_id; END IF;
    ELSE
      UPDATE public.subscriptions SET active_until = now()
       WHERE user_id = uid AND active_until IS NOT NULL AND active_until > now();
    END IF;
    RETURN 'devolvido';
  ELSE
    UPDATE public.payments SET status = _status
     WHERE asaas_payment_id = _payment_id AND status IN ('pending', 'overdue');
    RETURN 'atualizado';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.asaas_apply_payment(text, text, text, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.asaas_apply_payment(text, text, text, text, numeric, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
