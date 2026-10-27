-- LGPD: aceite dos termos (com versão e data), exportar os próprios dados e excluir a conta.
-- Depende de 0020 (handle_new_user) e 0022.

ALTER TABLE public.profiles ADD COLUMN terms_version text, ADD COLUMN terms_accepted_at timestamptz;

-- Versão em vigor. Quando os textos mudarem de forma relevante, troque aqui e em src/lib/legal.ts:
-- todo mundo vê o pedido de aceite de novo.
CREATE FUNCTION public.current_terms_version() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-10-27' $$;
REVOKE EXECUTE ON FUNCTION public.current_terms_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_terms_version() TO anon, authenticated;

-- O aceite só muda por aqui (ou pelo cadastro), não por UPDATE direto no perfil.
CREATE FUNCTION public.guard_profile_terms() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_setting('app.terms_ok', true) IS DISTINCT FROM 'on' THEN
      NEW.terms_version := NULL; NEW.terms_accepted_at := NULL;
    END IF;
  ELSIF (NEW.terms_version IS DISTINCT FROM OLD.terms_version OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at)
        AND current_setting('app.terms_ok', true) IS DISTINCT FROM 'on' THEN
    NEW.terms_version := OLD.terms_version; NEW.terms_accepted_at := OLD.terms_accepted_at;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_terms() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_terms_guard BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_terms();

CREATE FUNCTION public.accept_terms(_version text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
  IF _version IS DISTINCT FROM public.current_terms_version() THEN RAISE EXCEPTION 'TERMOS_DESATUALIZADOS' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.terms_ok', 'on', true);
  UPDATE public.profiles SET terms_version = _version, terms_accepted_at = now() WHERE id = auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.accept_terms(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_terms(text) TO authenticated;

-- No cadastro por e-mail, a pessoa marca o aceite e o app manda a versão nos metadados.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wanted text := lower(btrim(coalesce(NEW.raw_user_meta_data->>'username', '')));
  fname text := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  tv text := NEW.raw_user_meta_data->>'terms_version';
BEGIN
  IF tv IS NOT DISTINCT FROM public.current_terms_version() THEN
    PERFORM set_config('app.terms_ok', 'on', true);
  ELSE
    tv := NULL;
  END IF;
  IF wanted <> '' AND public.is_valid_username(wanted)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE slug = wanted) THEN
    BEGIN
      INSERT INTO public.profiles (id, full_name, slug, terms_version, terms_accepted_at)
      VALUES (NEW.id, fname, wanted, tv, CASE WHEN tv IS NULL THEN NULL ELSE now() END)
      ON CONFLICT (id) DO NOTHING;
      PERFORM set_config('app.terms_ok', 'off', true);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
  INSERT INTO public.profiles (id, full_name, terms_version, terms_accepted_at)
  VALUES (NEW.id, fname, tv, CASE WHEN tv IS NULL THEN NULL ELSE now() END)
  ON CONFLICT (id) DO NOTHING;
  PERFORM set_config('app.terms_ok', 'off', true);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Exportar tudo o que o app guarda sobre a própria pessoa (direito de acesso e portabilidade).
-- Mensagens: só as que ela enviou (as da outra pessoa são dados dela).
CREATE FUNCTION public.export_my_data() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); out jsonb;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'perfil', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = me),
    'telefones', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.contact_phones t WHERE t.user_id = me), '[]'),
    'enderecos', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.contact_addresses t WHERE t.user_id = me), '[]'),
    'habilidades', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.profile_skills t WHERE t.user_id = me), '[]'),
    'area_de_atuacao', (SELECT to_jsonb(w) FROM public.work_areas w WHERE w.user_id = me),
    'publicacoes', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.posts t WHERE t.user_id = me), '[]'),
    'locais_das_vagas', coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM public.post_locations l JOIN public.posts p ON p.id = l.post_id WHERE p.user_id = me), '[]'),
    'conversas', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.conversations c WHERE c.user_a = me OR c.user_b = me), '[]'),
    'mensagens_enviadas', coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM public.messages m WHERE m.sender_id = me), '[]'),
    'avaliacoes_feitas', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.reviews r WHERE r.reviewer_id = me), '[]'),
    'avaliacoes_recebidas', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.reviews r WHERE r.reviewee_id = me), '[]'),
    'servicos_combinados', coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.engagements e WHERE e.client_id = me OR e.provider_id = me), '[]'),
    'avisos', coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM public.notifications n WHERE n.user_id = me), '[]'),
    'preferencias_de_aviso', (SELECT to_jsonb(n) FROM public.notification_prefs n WHERE n.user_id = me),
    'plano', (SELECT to_jsonb(s) FROM public.subscriptions s WHERE s.user_id = me),
    'denuncias_enviadas', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.reports r WHERE r.reporter_id = me), '[]')
  ) INTO out;
  RETURN out;
END $$;
REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

-- Excluir a conta e tudo o que depende dela (perfil, vagas, conversas, avisos...). Não deixa excluir com
-- serviço combinado em andamento: primeiro conclua ou cancele.
CREATE FUNCTION public.delete_my_account() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.engagements e
             WHERE (e.client_id = me OR e.provider_id = me) AND e.status IN ('proposed', 'accepted')) THEN
    RAISE EXCEPTION 'CONTA_COM_SERVICO_ATIVO' USING ERRCODE = '55000';
  END IF;
  DELETE FROM auth.users WHERE id = me;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
