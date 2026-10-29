-- Pagamentos pelo Asaas: assinatura Premium (mensal) e selo Urgente avulso (R$ 2 por vaga).
-- Quem escreve aqui é o servidor (funções asaas-checkout, asaas-cancel e asaas-webhook, com a chave de
-- serviço). O app só lê os próprios pagamentos.

-- cliente do Asaas de cada pessoa (o CPF fica só no Asaas, nunca no nosso banco)
CREATE TABLE public.asaas_customers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.asaas_customers FROM anon, authenticated;
GRANT ALL ON public.asaas_customers TO service_role;
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('premium', 'urgent')),
  -- sem chave estrangeira de propósito: uma ligação entre perfis e vagas criaria um segundo caminho
  -- e confundiria as consultas embutidas do PostgREST (já aconteceu com a fila de espera)
  post_id uuid,
  asaas_payment_id text NOT NULL UNIQUE,
  asaas_subscription_id text,
  value numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'refunded', 'canceled')),
  invoice_url text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_user_idx ON public.payments (user_id, created_at DESC);
CREATE INDEX payments_post_idx ON public.payments (post_id) WHERE post_id IS NOT NULL;
REVOKE ALL ON public.payments FROM anon;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments read" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.subscriptions
  ADD COLUMN asaas_subscription_id text,
  ADD COLUMN first_paid_at timestamptz;

-- Urgente: quem não é Premium só ganha o selo pelo servidor (depois que o Asaas confirma o pagamento).
CREATE OR REPLACE FUNCTION public.guard_post_highlight() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.highlight AND NOT public.is_premium(NEW.user_id) THEN
    NEW.highlight := false;
  END IF;
  IF NEW.urgent AND (TG_OP = 'INSERT' OR NOT OLD.urgent) AND auth.uid() IS NOT NULL
     AND NOT public.is_premium(NEW.user_id) THEN
    NEW.urgent := false;
  END IF;
  RETURN NEW;
END $$;

-- Aplica um pagamento vindo do Asaas (chamada só pelo servidor). Atômica e repetível: o mesmo aviso chegando
-- duas vezes não estende o Premium duas vezes.
-- _status: pending | paid | overdue | refunded | canceled
CREATE OR REPLACE FUNCTION public.asaas_apply_payment(
  _payment_id text, _customer text, _subscription text, _ref text, _value numeric, _status text, _url text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid;
  k text := CASE WHEN _ref LIKE 'urgent:%' THEN 'urgent' ELSE 'premium' END;
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
    ELSE
      INSERT INTO public.subscriptions (user_id, plan, active_until, first_paid_at, asaas_subscription_id)
      VALUES (uid, 'premium', now() + interval '1 month', now(), _subscription)
      ON CONFLICT (user_id) DO UPDATE SET
        plan = 'premium',
        -- Premium vitalício (sem data) não muda
        active_until = CASE
          WHEN public.subscriptions.plan = 'premium' AND public.subscriptions.active_until IS NULL THEN NULL
          ELSE greatest(coalesce(public.subscriptions.active_until, now()), now()) + interval '1 month' END,
        first_paid_at = CASE
          WHEN public.subscriptions.asaas_subscription_id IS DISTINCT FROM excluded.asaas_subscription_id THEN now()
          ELSE coalesce(public.subscriptions.first_paid_at, now()) END,
        cancel_requested_at = CASE
          WHEN public.subscriptions.asaas_subscription_id IS DISTINCT FROM excluded.asaas_subscription_id THEN NULL
          ELSE public.subscriptions.cancel_requested_at END,
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

-- Assinatura cancelada no Asaas (por nós ou por lá): marca o pedido; o Premium vai até o fim do período pago.
CREATE FUNCTION public.asaas_mark_canceled(_subscription text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.subscriptions SET cancel_requested_at = coalesce(cancel_requested_at, now())
   WHERE asaas_subscription_id = _subscription
$$;
REVOKE EXECUTE ON FUNCTION public.asaas_mark_canceled(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.asaas_mark_canceled(text) TO service_role;

NOTIFY pgrst, 'reload schema';
