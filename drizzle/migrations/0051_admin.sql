-- Gestão (/admin): números, pendências, usuários e ações. Só moderadores (is_moderator()).
-- Toda ação fica registrada em admin_actions.

ALTER TABLE public.account_holds DROP CONSTRAINT IF EXISTS account_holds_role_check;
ALTER TABLE public.account_holds ADD CONSTRAINT account_holds_role_check
  CHECK (role IN ('reporter', 'reported', 'suspended'));
ALTER TABLE public.account_holds ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_plan_term_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_term_check
  CHECK (plan_term IN ('monthly', 'annual', 'referral', 'courtesy'));

ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('new_job', 'queue_turn', 'referral', 'suggestion_done', 'courtesy'));

CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_actions FROM anon, authenticated;
GRANT ALL ON public.admin_actions TO service_role;

CREATE OR REPLACE FUNCTION public.admin_guard() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_moderator() THEN RAISE EXCEPTION 'SEM_ACESSO' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_guard() FROM PUBLIC, anon, authenticated;

-- Aviso da própria conta: até quando e se é suspensão (para o aviso no topo)
CREATE OR REPLACE FUNCTION public.my_hold() RETURNS TABLE (until timestamptz, suspended boolean, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(ends_at), bool_or(role = 'suspended'), max(reason) FILTER (WHERE role = 'suspended')
  FROM public.account_holds WHERE user_id = auth.uid() AND lifted_at IS NULL AND ends_at > now()
  HAVING count(*) > 0;
$$;
REVOKE EXECUTE ON FUNCTION public.my_hold() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_hold() TO authenticated;

-- Visão geral + pendências + do cadastro ao serviço
CREATE OR REPLACE FUNCTION public.admin_overview(_since timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'users_new', (SELECT count(*) FROM auth.users WHERE created_at >= _since),
    'providers', (SELECT count(DISTINCT user_id) FROM public.profile_skills),
    'verified', (SELECT count(*) FROM public.user_checks WHERE document_at IS NOT NULL),
    'jobs_open', (SELECT count(*) FROM public.posts WHERE kind = 'job' AND closed_at IS NULL AND hidden_at IS NULL
                    AND (expires_at IS NULL OR expires_at > now())),
    'jobs_new', (SELECT count(*) FROM public.posts WHERE kind = 'job' AND created_at >= _since),
    'ads_new', (SELECT count(*) FROM public.posts WHERE kind = 'available' AND created_at >= _since),
    'convs_new', (SELECT count(*) FROM public.conversation_posts WHERE created_at >= _since),
    'deals_new', (SELECT count(*) FROM public.engagements WHERE status IN ('accepted', 'completed') AND coalesce(accepted_at, updated_at) >= _since),
    'done_new', (SELECT count(*) FROM public.engagements WHERE status = 'completed' AND coalesce(completed_at, updated_at) >= _since),
    'premium', (SELECT count(*) FROM public.subscriptions WHERE plan = 'premium' AND (active_until IS NULL OR active_until > now())),
    'premium_paying', (SELECT count(*) FROM public.subscriptions WHERE plan = 'premium' AND plan_term IN ('monthly', 'annual')
                         AND (active_until IS NULL OR active_until > now())),
    'revenue', (SELECT coalesce(sum(value), 0) FROM public.payments WHERE status = 'paid' AND paid_at >= _since),
    'todo', jsonb_build_object(
      'overdue', (SELECT count(*) FROM public.payments WHERE status = 'overdue'),
      'verifications', (SELECT count(*) FROM public.identity_verifications WHERE status = 'pending'),
      'reports', (SELECT count(*) FROM public.reports WHERE status = 'open'),
      'suggestions', (SELECT count(*) FROM public.suggestions WHERE status = 'new'),
      'emails_failed', (SELECT count(*) FROM public.email_outbox WHERE sent_at IS NULL AND attempts >= 5),
      'asaas_failed', (SELECT count(*) FROM public.referral_rewards WHERE kind = 'postpone' AND asaas_done_at IS NULL AND asaas_error IS NOT NULL)),
    'funnel', jsonb_build_object(
      'signed_up', (SELECT count(*) FROM auth.users),
      'skill', (SELECT count(DISTINCT user_id) FROM public.profile_skills),
      'verified', (SELECT count(*) FROM public.user_checks WHERE document_at IS NOT NULL),
      'posted', (SELECT count(DISTINCT user_id) FROM public.posts),
      'talked', (SELECT count(DISTINCT u) FROM (SELECT user_a u FROM public.conversations UNION SELECT user_b FROM public.conversations) x),
      'dealt', (SELECT count(DISTINCT u) FROM (SELECT client_id u FROM public.engagements WHERE status IN ('accepted', 'completed')
                                               UNION SELECT provider_id FROM public.engagements WHERE status IN ('accepted', 'completed')) y)));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_overview(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview(timestamptz) TO authenticated;

-- Busca de usuários (nome, @usuário ou e-mail)
CREATE OR REPLACE FUNCTION public.admin_users(_q text DEFAULT '', _limit integer DEFAULT 50)
RETURNS TABLE (id uuid, full_name text, username text, email text, avatar_path text, created_at timestamptz,
               premium boolean, plan_term text, email_ok boolean, doc boolean, phone boolean, suspended boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := '%' || lower(btrim(coalesce(_q, ''))) || '%';
BEGIN
  PERFORM public.admin_guard();
  RETURN QUERY
  SELECT u.id, coalesce(p.full_name, ''), p.slug, u.email::text, p.avatar_path, u.created_at,
         public.is_premium(u.id), s.plan_term, u.email_confirmed_at IS NOT NULL,
         coalesce(c.document_at IS NOT NULL, false), coalesce(c.phone_at IS NOT NULL, false),
         EXISTS (SELECT 1 FROM public.account_holds h WHERE h.user_id = u.id AND h.role = 'suspended'
                   AND h.lifted_at IS NULL AND h.ends_at > now())
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_checks c ON c.user_id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
  WHERE q = '%%' OR lower(coalesce(p.full_name, '')) LIKE q OR lower(coalesce(p.slug, '')) LIKE ltrim(q, '%@')
        OR lower(coalesce(p.slug, '')) LIKE q OR lower(u.email) LIKE q
  ORDER BY u.created_at DESC
  LIMIT greatest(1, least(_limit, 200));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_users(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users(text, integer) TO authenticated;

-- Ficha de um usuário
CREATE OR REPLACE FUNCTION public.admin_user(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN (
    SELECT jsonb_build_object(
      'id', u.id, 'full_name', coalesce(p.full_name, ''), 'username', p.slug, 'email', u.email,
      'avatar_path', p.avatar_path, 'created_at', u.created_at, 'last_seen_at', up.last_seen_at,
      'email_ok', u.email_confirmed_at IS NOT NULL,
      'doc', coalesce(c.document_at IS NOT NULL, false), 'phone', coalesce(c.phone_at IS NOT NULL, false),
      'premium', public.is_premium(u.id), 'plan_term', s.plan_term, 'active_until', s.active_until,
      'cancel_requested_at', s.cancel_requested_at,
      'skills', coalesce((SELECT jsonb_agg(skill ORDER BY skill) FROM public.profile_skills WHERE user_id = u.id), '[]'::jsonb),
      'jobs', (SELECT count(*) FROM public.posts WHERE user_id = u.id AND kind = 'job'),
      'ads', (SELECT count(*) FROM public.posts WHERE user_id = u.id AND kind = 'available'),
      'conversations', (SELECT count(*) FROM public.conversations WHERE user_a = u.id OR user_b = u.id),
      'deals', (SELECT count(*) FROM public.engagements WHERE (client_id = u.id OR provider_id = u.id) AND status IN ('accepted', 'completed')),
      'invited', (SELECT count(*) FROM public.referrals WHERE referrer_id = u.id),
      'invited_counted', (SELECT count(*) FROM public.referrals WHERE referrer_id = u.id AND counted_at IS NOT NULL),
      'invited_by', (SELECT pr.slug FROM public.referrals r JOIN public.profiles pr ON pr.id = r.referrer_id WHERE r.referred_id = u.id),
      'reports_against', (SELECT count(*) FROM public.account_holds WHERE user_id = u.id AND role = 'reported'),
      'paid_total', (SELECT coalesce(sum(value), 0) FROM public.payments WHERE user_id = u.id AND status = 'paid'),
      'suspended_until', (SELECT max(ends_at) FROM public.account_holds WHERE user_id = u.id AND role = 'suspended'
                            AND lifted_at IS NULL AND ends_at > now()),
      'actions', coalesce((SELECT jsonb_agg(jsonb_build_object('action', a.action, 'details', a.details, 'created_at', a.created_at,
                                                              'by', (SELECT full_name FROM public.profiles WHERE id = a.admin_id))
                                            ORDER BY a.created_at DESC)
                           FROM public.admin_actions a WHERE a.target_id = u.id), '[]'::jsonb))
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.user_checks c ON c.user_id = u.id
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    LEFT JOIN public.user_presence up ON up.user_id = u.id
    WHERE u.id = _id);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user(uuid) TO authenticated;

-- Dar dias de Premium de cortesia
CREATE OR REPLACE FUNCTION public.admin_grant_premium(_id uuid, _days integer DEFAULT 30)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; till timestamptz; d integer := greatest(1, least(coalesce(_days, 30), 365));
BEGIN
  PERFORM public.admin_guard();
  SELECT * INTO s FROM public.subscriptions WHERE user_id = _id FOR UPDATE;
  IF FOUND AND s.plan = 'premium' AND s.active_until IS NULL THEN
    till := NULL; -- Premium sem fim: nada a somar
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
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_id, 'courtesy', 'Você ganhou ' || d || ' dias de Premium!',
          'Presente da equipe Beecos' || CASE WHEN till IS NOT NULL
            THEN '. Vale até ' || to_char(till AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || '.' ELSE '.' END);
  INSERT INTO public.admin_actions (admin_id, target_id, action, details)
  VALUES (auth.uid(), _id, 'premium', jsonb_build_object('days', d, 'until', till));
  RETURN till;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_premium(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium(uuid, integer) TO authenticated;

-- Suspender (não publica, não negocia, não recebe propostas) e liberar
CREATE OR REPLACE FUNCTION public.admin_suspend(_id uuid, _days integer, _reason text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE till timestamptz := now() + make_interval(days => greatest(1, least(coalesce(_days, 7), 3650)));
BEGIN
  PERFORM public.admin_guard();
  IF EXISTS (SELECT 1 FROM public.moderators WHERE user_id = _id) THEN
    RAISE EXCEPTION 'NAO_SUSPENDE_MODERADOR';
  END IF;
  INSERT INTO public.account_holds (user_id, role, ends_at, reason) VALUES (_id, 'suspended', till, left(coalesce(_reason, ''), 300));
  INSERT INTO public.admin_actions (admin_id, target_id, action, details)
  VALUES (auth.uid(), _id, 'suspend', jsonb_build_object('until', till, 'reason', _reason));
  RETURN till;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_suspend(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unsuspend(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  UPDATE public.account_holds SET lifted_at = now()
   WHERE user_id = _id AND role = 'suspended' AND lifted_at IS NULL AND ends_at > now();
  INSERT INTO public.admin_actions (admin_id, target_id, action) VALUES (auth.uid(), _id, 'unsuspend');
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_unsuspend(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend(uuid) TO authenticated;
