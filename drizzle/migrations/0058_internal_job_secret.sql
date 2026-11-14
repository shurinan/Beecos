-- Tarefas internas (e-mails, avisos no celular, limpeza de anexos, indicações no Asaas) só rodam quando
-- o próprio banco chama: cada chamada leva um segredo guardado em app_keys (só o servidor lê),
-- e as funções recusam quem não traz o segredo.

INSERT INTO public.app_keys (name, value)
VALUES ('internal_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.call_internal_function(_name text, _timeout integer DEFAULT 55000)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s text;
BEGIN
  IF _name NOT IN ('send-emails', 'send-push', 'cleanup-chat-files', 'referral-rewards') THEN
    RAISE EXCEPTION 'função interna desconhecida: %', _name;
  END IF;
  SELECT value INTO s FROM public.app_keys WHERE name = 'internal_secret';
  IF s IS NULL THEN
    RAISE EXCEPTION 'segredo interno ausente';
  END IF;
  RETURN net.http_post(
    url := 'https://qfheectjquxfgmexahem.supabase.co/functions/v1/' || _name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', s),
    body := '{}'::jsonb,
    timeout_milliseconds := _timeout);
END $$;
REVOKE EXECUTE ON FUNCTION public.call_internal_function(text, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_push(_user uuid, _title text, _body text, _url text, _tag text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user IS NULL OR NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = _user) THEN
    RETURN;
  END IF;
  INSERT INTO public.push_outbox (user_id, title, body, url, tag)
  VALUES (_user, left(_title, 120), left(coalesce(_body, ''), 200), coalesce(_url, '/'), _tag);
  PERFORM public.call_internal_function('send-push', 30000);
EXCEPTION WHEN others THEN
  RAISE WARNING 'queue_push: %', SQLERRM;
END $function$;
