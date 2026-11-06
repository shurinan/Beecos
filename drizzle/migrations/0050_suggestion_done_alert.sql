-- Quando a equipe marca uma ideia como "Feita", quem sugeriu recebe um aviso no app.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('new_job', 'queue_turn', 'referral', 'suggestion_done'));

CREATE OR REPLACE FUNCTION public.notify_suggestion_done() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.user_id, 'suggestion_done', 'Sua ideia entrou no Beecos! 💡',
            'A sua sugestão “' || left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 80) ||
            CASE WHEN length(NEW.body) > 80 THEN '…' ELSE '' END ||
            '” já está no app. Muito obrigado por contribuir com a melhoria do Beecos!');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER suggestion_done_alert AFTER UPDATE OF status ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.notify_suggestion_done();
