-- O e-mail "tem interesse" passa a sair a cada publicação nova na conversa (conversation_posts),
-- e não só quando a conversa é criada: o par de pessoas tem uma conversa só, com vários assuntos.
DROP TRIGGER IF EXISTS email_interest ON public.conversations;
DROP FUNCTION IF EXISTS public.email_on_conversation();

CREATE OR REPLACE FUNCTION public.email_on_conversation_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; c record; quem uuid;
BEGIN
  SELECT id, user_id, title, price, kind INTO p FROM public.posts WHERE id = NEW.post_id;
  SELECT user_a, user_b INTO c FROM public.conversations WHERE id = NEW.conversation_id;
  IF p.user_id IS NULL OR c.user_a IS NULL THEN RETURN NEW; END IF;
  quem := CASE WHEN c.user_a = p.user_id THEN c.user_b ELSE c.user_a END;
  IF quem IS NULL OR quem = p.user_id THEN RETURN NEW; END IF;
  PERFORM public.queue_email(p.user_id, 'interest', false,
    jsonb_build_object('quem', public.person_name(quem), 'vaga', p.title, 'valor', p.price, 'tipo', p.kind),
    'interest:' || NEW.conversation_id || ':' || NEW.post_id);
  RETURN NEW;
END $$;
CREATE TRIGGER email_interest AFTER INSERT ON public.conversation_posts FOR EACH ROW EXECUTE FUNCTION public.email_on_conversation_post();
