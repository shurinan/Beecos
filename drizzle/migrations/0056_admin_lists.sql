-- Gestão parte 2: listas de Pagamentos, Indicações e E-mails (só moderadores).

CREATE OR REPLACE FUNCTION public.admin_payments(_status text DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'totals', (SELECT coalesce(jsonb_object_agg(status, jsonb_build_object('n', n, 'value', v)), '{}'::jsonb)
               FROM (SELECT status, count(*) n, coalesce(sum(value), 0) v FROM public.payments GROUP BY status) t),
    'paid_month', (SELECT coalesce(sum(value), 0) FROM public.payments
                   WHERE status = 'paid' AND paid_at >= date_trunc('month', now())),
    'rows', coalesce((
      SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM (
        SELECT pm.id, pm.user_id, coalesce(nullif(p.full_name, ''), 'Sem nome') AS name, p.slug AS username,
               u.email, pm.kind, pm.value, pm.status, pm.created_at, pm.paid_at, pm.invoice_url
        FROM public.payments pm
        LEFT JOIN public.profiles p ON p.id = pm.user_id
        LEFT JOIN auth.users u ON u.id = pm.user_id
        WHERE _status IS NULL OR pm.status = _status
        ORDER BY pm.created_at DESC
        LIMIT greatest(1, least(_limit, 300))) r), '[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_payments(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payments(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_referrals()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'invited', (SELECT count(*) FROM public.referrals),
    'counted', (SELECT count(*) FROM public.referrals WHERE counted_at IS NOT NULL),
    'rewards', (SELECT count(*) FROM public.referral_rewards),
    'ranking', coalesce((
      SELECT jsonb_agg(r ORDER BY r.counted DESC, r.invited DESC) FROM (
        SELECT f.referrer_id AS user_id, coalesce(nullif(p.full_name, ''), 'Sem nome') AS name, p.slug AS username,
               count(*) AS invited, count(*) FILTER (WHERE f.counted_at IS NOT NULL) AS counted,
               (SELECT count(*) FROM public.referral_rewards w WHERE w.user_id = f.referrer_id) AS rewards,
               max(f.created_at) AS last_at
        FROM public.referrals f LEFT JOIN public.profiles p ON p.id = f.referrer_id
        GROUP BY f.referrer_id, p.full_name, p.slug
        LIMIT 100) r), '[]'::jsonb),
    'recent', coalesce((
      SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM (
        SELECT f.created_at, f.counted_at IS NOT NULL AS counted,
               coalesce(nullif(a.full_name, ''), 'Sem nome') AS invitee, coalesce(nullif(b.full_name, ''), 'Sem nome') AS referrer,
               b.slug AS referrer_username,
               u.email_confirmed_at IS NOT NULL AS email,
               EXISTS (SELECT 1 FROM public.profile_skills s WHERE s.user_id = f.referred_id) AS skill,
               EXISTS (SELECT 1 FROM public.user_checks c WHERE c.user_id = f.referred_id AND c.document_at IS NOT NULL) AS doc
        FROM public.referrals f
        LEFT JOIN public.profiles a ON a.id = f.referred_id
        LEFT JOIN public.profiles b ON b.id = f.referrer_id
        LEFT JOIN auth.users u ON u.id = f.referred_id
        ORDER BY f.created_at DESC LIMIT 50) r), '[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referrals() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_emails(_only_failed boolean DEFAULT false, _limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  RETURN jsonb_build_object(
    'sent_today', (SELECT count(*) FROM public.email_outbox WHERE sent_at >= date_trunc('day', now())),
    'sent_7d', (SELECT count(*) FROM public.email_outbox WHERE sent_at >= now() - interval '7 days'),
    'waiting', (SELECT count(*) FROM public.email_outbox WHERE sent_at IS NULL AND attempts < 5 AND created_at > now() - interval '3 days'),
    'failed', (SELECT count(*) FROM public.email_outbox WHERE sent_at IS NULL AND (attempts >= 5 OR created_at <= now() - interval '3 days')),
    'rows', coalesce((
      SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM (
        SELECT o.id, o.to_email, o.kind, o.essential, o.created_at, o.sent_at, o.attempts, o.last_error,
               coalesce(nullif(p.full_name, ''), 'Sem nome') AS name
        FROM public.email_outbox o LEFT JOIN public.profiles p ON p.id = o.user_id
        WHERE NOT _only_failed OR (o.sent_at IS NULL AND o.attempts > 0)
        ORDER BY o.created_at DESC
        LIMIT greatest(1, least(_limit, 300))) r), '[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_emails(boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_emails(boolean, integer) TO authenticated;

-- "Tentar de novo" num e-mail que falhou: volta para a fila agora
CREATE OR REPLACE FUNCTION public.admin_retry_email(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  UPDATE public.email_outbox SET attempts = 0, last_error = NULL, created_at = now()
   WHERE id = _id AND sent_at IS NULL;
  INSERT INTO public.admin_actions (admin_id, action, details) VALUES (auth.uid(), 'retry_email', jsonb_build_object('email', _id));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_retry_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_email(uuid) TO authenticated;
