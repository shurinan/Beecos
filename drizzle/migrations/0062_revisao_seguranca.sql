-- Revisão de segurança (23/11/2026).

-- 1) A avaliação não pode mudar de avaliado, de autor nem de data depois de criada.
--    Antes, quem avaliou um parceiro podia editar a linha e apontar a nota para qualquer pessoa.
CREATE OR REPLACE FUNCTION public.reviews_lock_parties()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.reviewer_id := OLD.reviewer_id;
  NEW.reviewee_id := OLD.reviewee_id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reviews_lock_parties ON public.reviews;
CREATE TRIGGER reviews_lock_parties BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_lock_parties();

-- 2) A data de criação não muda por quem usa o app (travava a vaga no topo da lista e deixava
--    qualquer conta parecer "nova" para o convite). Migrações e funções internas seguem livres.
CREATE OR REPLACE FUNCTION public.keep_created_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.created_at := OLD.created_at; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS posts_keep_created_at ON public.posts;
CREATE TRIGGER posts_keep_created_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.keep_created_at();
DROP TRIGGER IF EXISTS profiles_keep_created_at ON public.profiles;
CREATE TRIGGER profiles_keep_created_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_created_at();
DROP TRIGGER IF EXISTS channels_keep_created_at ON public.channels;
CREATE TRIGGER channels_keep_created_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.keep_created_at();

-- 3) Só quem participa pergunta: não dá mais para testar se duas outras pessoas conversam
--    ou se uma contratou a outra.
CREATE OR REPLACE FUNCTION public.can_review(_reviewer uuid, _reviewee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _reviewer = auth.uid() AND _reviewer <> _reviewee AND EXISTS (
    SELECT 1 FROM public.engagements e
    WHERE e.status = 'completed'
      AND ((e.client_id = _reviewer AND e.provider_id = _reviewee)
        OR (e.client_id = _reviewee AND e.provider_id = _reviewer))
  )
$$;
CREATE OR REPLACE FUNCTION public.in_active_conversation(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a = auth.uid() AND _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE ((c.user_a = _a AND c.user_b = _b) OR (c.user_a = _b AND c.user_b = _a))
      AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.sender_id = _a AND m.kind = 'user')
      AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id AND m.sender_id = _b AND m.kind = 'user')
  )
$$;

-- 4) A lista de assinantes Premium deixa de ser lida direto. Só as funções do banco a usam.
REVOKE ALL ON public.premium_users FROM anon, authenticated;
GRANT ALL ON public.premium_users TO service_role;

-- 5) Privacidade do link de convite. Padrão: nome completo e foto aparecem para quem ainda não
--    tem conta. Quem ligar a opção mostra só o primeiro nome, sem foto, para quem não está logado.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_from_visitors boolean NOT NULL DEFAULT false;
GRANT UPDATE (hide_from_visitors) ON public.profiles TO authenticated;

DROP FUNCTION IF EXISTS public.referral_inviter(text);
CREATE FUNCTION public.referral_inviter(_username text)
RETURNS TABLE (first_name text, full_name text, avatar_path text, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT split_part(coalesce(nullif(p.full_name, ''), 'Alguém'), ' ', 1),
         CASE WHEN p.hide_from_visitors AND auth.uid() IS NULL
              THEN split_part(coalesce(nullif(p.full_name, ''), 'Alguém'), ' ', 1)
              ELSE coalesce(nullif(p.full_name, ''), 'Alguém') END,
         CASE WHEN p.hide_from_visitors AND auth.uid() IS NULL THEN NULL ELSE p.avatar_path END,
         p.slug
  FROM public.profiles p WHERE p.slug = lower(btrim(_username)) LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.referral_inviter(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_inviter(text) TO anon, authenticated;
