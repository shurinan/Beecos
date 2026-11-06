-- E-mail a cada mensagem nova (no lugar do resumo de não lidas de 1 vez por dia).
-- Sai quando a mensagem continua sem ler 2 minutos depois e a pessoa não está com o app aberto
-- (sem "visto por último" nos últimos 2 minutos). No máximo 1 e-mail a cada 30 minutos por
-- conversa: se chegarem várias, o e-mail diz quantas e mostra a última.
CREATE OR REPLACE FUNCTION public.queue_new_message_emails() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT me.uid, m.conversation_id,
           count(*)::int AS n,
           (array_agg(m.sender_id ORDER BY m.created_at DESC))[1] AS sender,
           (array_agg(left(coalesce(nullif(m.content, ''), ''), 140) ORDER BY m.created_at DESC))[1] AS texto
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    CROSS JOIN LATERAL (SELECT CASE WHEN c.user_a = m.sender_id THEN c.user_b ELSE c.user_a END AS uid) me
    LEFT JOIN public.conversation_reads cr ON cr.conversation_id = c.id AND cr.user_id = me.uid
    WHERE m.kind = 'user' AND m.sender_id <> me.uid
      AND m.created_at < now() - interval '2 minutes' AND m.created_at > now() - interval '6 hours'
      AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
      AND NOT EXISTS (SELECT 1 FROM public.user_presence up
                      WHERE up.user_id = me.uid AND up.last_seen_at > now() - interval '2 minutes')
      -- só mensagens que chegaram depois do último e-mail desta conversa
      AND m.created_at > coalesce((SELECT max(o.created_at) FROM public.email_outbox o
                                   WHERE o.user_id = me.uid AND o.kind = 'new_message'
                                     AND o.payload->>'conv' = c.id::text), '-infinity'::timestamptz)
    GROUP BY me.uid, m.conversation_id
    -- no máximo 1 e-mail a cada 30 minutos por conversa
    HAVING NOT EXISTS (SELECT 1 FROM public.email_outbox o
                       WHERE o.user_id = me.uid AND o.kind = 'new_message'
                         AND o.payload->>'conv' = m.conversation_id::text
                         AND o.created_at > now() - interval '30 minutes')
  LOOP
    PERFORM public.queue_email(r.uid, 'new_message', false,
      jsonb_build_object(
        'conv', r.conversation_id,
        'n', r.n,
        'de', public.person_name(r.sender),
        'texto', r.texto,
        'link', '/conversas/' || coalesce((SELECT slug FROM public.profiles WHERE id = r.sender), r.sender::text)),
      'msg:' || r.conversation_id || ':' || r.uid || ':' || floor(extract(epoch FROM now()) / 60)::bigint);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_new_message_emails() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('beecos-emails-nao-lidas');
SELECT cron.schedule('beecos-emails-mensagens', '* * * * *', $$ SELECT public.queue_new_message_emails() $$);
