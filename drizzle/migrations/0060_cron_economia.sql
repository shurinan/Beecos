-- Economia no servidor: as tarefas de minuto em minuto só chamam a função quando há trabalho.
-- Antes: send-emails rodava 1.440 vezes por dia mesmo com a fila vazia; referral-rewards, 144.
-- (aplicada direto no banco em 16/11/2026)

-- e-mails: só quando há e-mail pronto para sair (mesma regra de claim_emails)
SELECT cron.schedule('beecos-emails-envio', '* * * * *', $$
  SELECT public.call_internal_function('send-emails', 55000)
  WHERE EXISTS (SELECT 1 FROM public.email_outbox
                WHERE sent_at IS NULL AND attempts < 5 AND created_at > now() - interval '3 days'
                  AND (kind <> 'pay_pending' OR created_at < now() - interval '15 minutes'))
$$);

-- Asaas: só quando há prêmio de indicação esperando (mesma regra de claim_postpones)
SELECT cron.schedule('beecos-indicacoes-asaas', '*/10 * * * *', $$
  SELECT public.call_internal_function('referral-rewards', 55000)
  WHERE EXISTS (SELECT 1 FROM public.referral_rewards
                WHERE kind = 'postpone' AND asaas_done_at IS NULL AND asaas_attempts < 5
                  AND asaas_subscription_id IS NOT NULL)
$$);

-- histórico das tarefas: guarda só 7 dias (todo dia às 03:40 de Brasília)
SELECT cron.schedule('beecos-limpar-historico', '40 6 * * *', $$
  DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'
$$);
