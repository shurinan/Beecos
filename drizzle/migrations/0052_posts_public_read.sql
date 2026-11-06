-- Visitante sem conta (link compartilhado /v/codigo) lê vagas e anúncios abertos.
-- A regra antiga consultava conversations, que o visitante não pode ler, e falhava para ele.
ALTER POLICY "posts readable" ON public.posts TO authenticated;
CREATE POLICY "open posts readable by visitors" ON public.posts FOR SELECT TO anon
  USING (hidden_at IS NULL AND closed_at IS NULL AND (expires_at IS NULL OR expires_at > now()));
