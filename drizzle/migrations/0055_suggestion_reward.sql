-- Agradecimento por sugestão: a equipe dá 15 dias de Premium para quem sugeriu (uma vez por sugestão).

ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;

-- Soma dias de Premium (sem conferir quem chama; usado pelas funções da equipe)
CREATE OR REPLACE FUNCTION public.grant_premium_days(_id uuid, _days integer)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; till timestamptz; d integer := greatest(1, least(coalesce(_days, 30), 365));
BEGIN
  SELECT * INTO s FROM public.subscriptions WHERE user_id = _id FOR UPDATE;
  IF FOUND AND s.plan = 'premium' AND s.active_until IS NULL THEN
    RETURN NULL; -- Premium sem fim: nada a somar
  ELSIF FOUND AND s.plan = 'premium' AND s.active_until > now() THEN
    UPDATE public.subscriptions SET active_until = active_until + make_interval(days => d) WHERE user_id = _id
      RETURNING active_until INTO till;
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, active_until, plan_term, cancel_requested_at)
    VALUES (_id, 'premium', now() + make_interval(days => d), 'courtesy', now())
    ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', active_until = now() + make_interval(days => d),
      plan_term = 'courtesy', cancel_requested_at = now(), asaas_subscription_id = NULL
    RETURNING active_until INTO till;
  END IF;
  RETURN till;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_premium_days(uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_premium(_id uuid, _days integer DEFAULT 30)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE till timestamptz; d integer := greatest(1, least(coalesce(_days, 30), 365));
BEGIN
  PERFORM public.admin_guard();
  till := public.grant_premium_days(_id, d);
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_id, 'courtesy', 'Você ganhou ' || d || ' dias de Premium!',
          'Presente da equipe Beecos' || CASE WHEN till IS NOT NULL
            THEN '. Vale até ' || to_char(till AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || '.' ELSE '.' END);
  INSERT INTO public.admin_actions (admin_id, target_id, action, details)
  VALUES (auth.uid(), _id, 'premium', jsonb_build_object('days', d, 'until', till));
  RETURN till;
END $$;

-- Botão "Dar 15 dias de Premium" na tela de Sugestões
CREATE OR REPLACE FUNCTION public.reward_suggestion(_suggestion uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sg record; till timestamptz;
BEGIN
  PERFORM public.admin_guard();
  SELECT * INTO sg FROM public.suggestions WHERE id = _suggestion FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUGESTAO_NAO_ENCONTRADA'; END IF;
  IF sg.rewarded_at IS NOT NULL THEN RAISE EXCEPTION 'JA_PREMIADA'; END IF;
  till := public.grant_premium_days(sg.user_id, 15);
  UPDATE public.suggestions SET rewarded_at = now() WHERE id = _suggestion;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (sg.user_id, 'courtesy', 'Obrigado pela sua sugestão! 🎁',
          'Você ganhou 15 dias de Premium como agradecimento por ajudar a melhorar o Beecos'
          || CASE WHEN till IS NOT NULL
               THEN '. Vale até ' || to_char(till AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || '.' ELSE '.' END);
  INSERT INTO public.admin_actions (admin_id, target_id, action, details)
  VALUES (auth.uid(), sg.user_id, 'premium', jsonb_build_object('days', 15, 'until', till, 'reason', 'sugestão'));
  RETURN till;
END $$;
REVOKE EXECUTE ON FUNCTION public.reward_suggestion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reward_suggestion(uuid) TO authenticated;
