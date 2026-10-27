-- Endurecimento: "menor privilégio" nas tabelas e funções. O RLS já bloqueava, mas o Supabase concede
-- permissões demais por padrão; aqui tiramos o que o app não usa (defesa em camadas).
-- Depende de 0000-0023.

-- 1) Visitante (anon) nunca escreve. Só lê o que o app mostra sem login.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE SELECT ON public.conversations, public.messages, public.profile_private, public.subscriptions,
                  public.conversation_posts, public.notification_prefs, public.notifications
  FROM anon;

-- 2) Funções de gatilho não são chamadas por ninguém do app.
REVOKE EXECUTE ON FUNCTION public.bump_conversation(), public.enforce_chat_limit(), public.enforce_job_limit(),
                          public.enforce_phone_limit(), public.enforce_skill_limit()
  FROM PUBLIC, anon, authenticated;

-- 3) Tabelas novas criadas no futuro não herdam permissão de escrita para o visitante.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;
