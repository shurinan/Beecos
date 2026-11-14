-- lovable-cron-fallback-reviewed: existing jobs, same cadence; only the command changes to send the internal key
-- Agendas das tarefas internas: chamam a função acima (que leva o segredo).
SELECT cron.schedule('beecos-emails-envio', '* * * * *', $$ SELECT public.call_internal_function('send-emails', 55000) $$);
SELECT cron.schedule('beecos-push-envio', '* * * * *', $$
  SELECT public.call_internal_function('send-push', 55000)
  WHERE EXISTS (SELECT 1 FROM public.push_outbox WHERE sent_at IS NULL AND attempts < 3
                AND created_at > now() - interval '1 hour')
$$);
SELECT cron.schedule('beecos-anexos-48h', '7 * * * *', $$ SELECT public.call_internal_function('cleanup-chat-files', 55000) $$);
SELECT cron.schedule('beecos-indicacoes-asaas', '*/10 * * * *', $$ SELECT public.call_internal_function('referral-rewards', 55000) $$);
