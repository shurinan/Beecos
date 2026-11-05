-- Indique e ganhe. Quem traz 5 prestadores ganha 1 mês de Premium.
-- O indicado conta quando: confirmou o e-mail, tem 1 habilidade e verificou a identidade.
-- Um prêmio por vez: depois de um prêmio, o próximo só sai 30 dias depois (os indicados seguem contando).
-- Prêmio: plano grátis → 30 dias de Premium; mensal que renova → próxima cobrança adiada 30 dias
-- (a função referral-rewards muda a data no Asaas); anual ou mensal cancelado → mais 30 dias.

ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_plan_term_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_term_check
  CHECK (plan_term IN ('monthly', 'annual', 'referral'));
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('new_job', 'queue_turn', 'referral'));

CREATE TABLE public.referrals (
  referred_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  counted_at timestamptz,
  reward_id uuid,
  CHECK (referred_id <> referrer_id)
);
CREATE INDEX referrals_referrer ON public.referrals (referrer_id);

CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('free', 'extend', 'postpone')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  until timestamptz,
  asaas_subscription_id text,
  asaas_done_at timestamptz,
  asaas_attempts integer NOT NULL DEFAULT 0,
  asaas_error text
);
CREATE INDEX referral_rewards_user ON public.referral_rewards (user_id, granted_at DESC);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referrals, public.referral_rewards FROM anon, authenticated;
GRANT ALL ON public.referrals, public.referral_rewards TO service_role;

-- Quem convidou (para a página do link, também para quem ainda não tem conta)
CREATE OR REPLACE FUNCTION public.referral_inviter(_username text)
RETURNS TABLE (first_name text, full_name text, avatar_path text, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT split_part(coalesce(nullif(full_name, ''), 'Alguém'), ' ', 1), coalesce(nullif(full_name, ''), 'Alguém'),
         avatar_path, slug
  FROM public.profiles WHERE slug = lower(btrim(_username)) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.referral_inviter(text) TO anon, authenticated;

-- O convidado registra quem o convidou. Só vale para conta nova (até 3 dias) e uma vez.
CREATE OR REPLACE FUNCTION public.claim_referral(_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); ref uuid; made timestamptz;
BEGIN
  IF me IS NULL THEN RETURN 'sem_login'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = me) THEN RETURN 'ja_indicado'; END IF;
  SELECT id INTO ref FROM public.profiles WHERE slug = lower(btrim(_username));
  IF ref IS NULL THEN RETURN 'nao_encontrado'; END IF;
  IF ref = me THEN RETURN 'proprio'; END IF;
  SELECT created_at INTO made FROM auth.users WHERE id = me;
  IF made < now() - interval '3 days' THEN RETURN 'conta_antiga'; END IF;
  INSERT INTO public.referrals (referred_id, referrer_id) VALUES (me, ref) ON CONFLICT DO NOTHING;
  RETURN 'ok';
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

-- O indicado já conta? (e-mail confirmado, 1 habilidade, identidade verificada)
CREATE OR REPLACE FUNCTION public.referral_ready(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = _u AND email_confirmed_at IS NOT NULL)
     AND EXISTS (SELECT 1 FROM public.profile_skills WHERE user_id = _u)
     AND EXISTS (SELECT 1 FROM public.user_checks WHERE user_id = _u AND document_at IS NOT NULL);
$$;
REVOKE EXECUTE ON FUNCTION public.referral_ready(uuid) FROM PUBLIC, anon, authenticated;

-- Dá o prêmio (chamada só por evaluate_referrals)
CREATE OR REPLACE FUNCTION public.grant_referral_reward(_u uuid, _batch uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; active boolean; k text; till timestamptz; rid uuid; body text;
BEGIN
  SELECT * INTO s FROM public.subscriptions WHERE user_id = _u FOR UPDATE;
  active := FOUND AND s.plan = 'premium' AND (s.active_until IS NULL OR s.active_until > now());
  IF active AND s.active_until IS NULL THEN
    k := 'extend'; till := NULL;
  ELSIF active AND s.plan_term = 'monthly' AND s.asaas_subscription_id IS NOT NULL AND s.cancel_requested_at IS NULL THEN
    k := 'postpone';
    UPDATE public.subscriptions SET active_until = active_until + interval '30 days' WHERE user_id = _u
      RETURNING active_until INTO till;
  ELSIF active THEN
    k := 'extend';
    UPDATE public.subscriptions SET active_until = active_until + interval '30 days' WHERE user_id = _u
      RETURNING active_until INTO till;
  ELSE
    k := 'free';
    INSERT INTO public.subscriptions (user_id, plan, active_until, plan_term, cancel_requested_at)
    VALUES (_u, 'premium', now() + interval '30 days', 'referral', now())
    ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', active_until = now() + interval '30 days',
      plan_term = 'referral', cancel_requested_at = now(), asaas_subscription_id = NULL
    RETURNING active_until INTO till;
  END IF;

  INSERT INTO public.referral_rewards (user_id, kind, until, asaas_subscription_id)
  VALUES (_u, k, till, CASE WHEN k = 'postpone' THEN s.asaas_subscription_id END)
  RETURNING id INTO rid;
  UPDATE public.referrals SET reward_id = rid WHERE referred_id = ANY (_batch);

  body := CASE k
    WHEN 'free' THEN 'Obrigado por trazer prestadores. O Premium vale até ' || to_char(till AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || '.'
    WHEN 'postpone' THEN 'Obrigado por trazer prestadores. Sua próxima cobrança foi adiada em 30 dias.'
    ELSE 'Obrigado por trazer prestadores. Seu Premium ganhou mais 30 dias.' END;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_u, 'referral', 'Você ganhou 1 mês de Premium!', body);
  PERFORM public.queue_email(_u, 'referral_reward', true,
    jsonb_build_object('tipo', k, 'ate', to_char(till AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')),
    'referral:' || rid);
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_referral_reward(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- Atualiza quem já conta e dá o prêmio quando chegar a 5 (um prêmio a cada 30 dias)
CREATE OR REPLACE FUNCTION public.evaluate_referrals(_referrer uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE batch uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('referral:' || _referrer));
  UPDATE public.referrals r SET counted_at = now()
   WHERE r.referrer_id = _referrer AND r.counted_at IS NULL AND public.referral_ready(r.referred_id);
  IF EXISTS (SELECT 1 FROM public.referral_rewards
             WHERE user_id = _referrer AND granted_at > now() - interval '30 days') THEN
    RETURN;
  END IF;
  SELECT array_agg(referred_id) INTO batch FROM (
    SELECT referred_id FROM public.referrals
    WHERE referrer_id = _referrer AND counted_at IS NOT NULL AND reward_id IS NULL
    ORDER BY counted_at LIMIT 5) s;
  IF coalesce(array_length(batch, 1), 0) < 5 THEN RETURN; END IF;
  PERFORM public.grant_referral_reward(_referrer, batch);
END $$;
REVOKE EXECUTE ON FUNCTION public.evaluate_referrals(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_all_referrals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT referrer_id FROM public.referrals WHERE reward_id IS NULL LOOP
    BEGIN
      PERFORM public.evaluate_referrals(r.referrer_id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'evaluate_referrals %: %', r.referrer_id, SQLERRM;
    END;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.evaluate_all_referrals() FROM PUBLIC, anon, authenticated;

-- A tela "Indique e ganhe": progresso, convidados e prêmios da pessoa logada
CREATE OR REPLACE FUNCTION public.referral_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); last_at timestamptz;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  PERFORM public.evaluate_referrals(me);
  SELECT max(granted_at) INTO last_at FROM public.referral_rewards WHERE user_id = me;
  RETURN jsonb_build_object(
    'username', (SELECT slug FROM public.profiles WHERE id = me),
    'counted', (SELECT count(*) FROM public.referrals WHERE referrer_id = me AND counted_at IS NOT NULL AND reward_id IS NULL),
    'next_at', CASE WHEN last_at > now() - interval '30 days' THEN last_at + interval '30 days' END,
    'rewards', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', kind, 'granted_at', granted_at, 'until', until) ORDER BY granted_at DESC)
                         FROM public.referral_rewards WHERE user_id = me), '[]'::jsonb),
    'people', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'name', coalesce(nullif(p.full_name, ''), 'Sem nome'),
               'avatar_path', p.avatar_path,
               'joined_at', r.created_at,
               'email', u.email_confirmed_at IS NOT NULL,
               'skill', EXISTS (SELECT 1 FROM public.profile_skills s WHERE s.user_id = r.referred_id),
               'doc', EXISTS (SELECT 1 FROM public.user_checks c WHERE c.user_id = r.referred_id AND c.document_at IS NOT NULL),
               'counted', r.counted_at IS NOT NULL,
               'rewarded', r.reward_id IS NOT NULL)
             ORDER BY r.created_at DESC)
      FROM public.referrals r
      LEFT JOIN public.profiles p ON p.id = r.referred_id
      LEFT JOIN auth.users u ON u.id = r.referred_id
      WHERE r.referrer_id = me), '[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.referral_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_status() TO authenticated;

-- A função referral-rewards pega os adiamentos de cobrança que ainda faltam fazer no Asaas
CREATE OR REPLACE FUNCTION public.claim_postpones(_limit integer DEFAULT 20)
RETURNS SETOF public.referral_rewards LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.referral_rewards w SET asaas_attempts = w.asaas_attempts + 1
  WHERE w.id IN (
    SELECT id FROM public.referral_rewards
    WHERE kind = 'postpone' AND asaas_done_at IS NULL AND asaas_attempts < 5 AND asaas_subscription_id IS NOT NULL
    ORDER BY granted_at LIMIT greatest(1, least(_limit, 50)) FOR UPDATE SKIP LOCKED)
  RETURNING w.*;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_postpones(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_postpones(integer) TO service_role;

SELECT cron.schedule('beecos-indicacoes', '*/15 * * * *', $$ SELECT public.evaluate_all_referrals() $$);
SELECT cron.schedule('beecos-indicacoes-asaas', '*/10 * * * *', $$
  SELECT net.http_post(
    url := 'https://qfheectjquxfgmexahem.supabase.co/functions/v1/referral-rewards',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 55000)
$$);
