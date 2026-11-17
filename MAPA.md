# Mapa do Beecos

Onde está cada peça, por área. Serve para achar rápido o que mexer sem abrir o projeto inteiro.
Quando criar ou mover algo, atualize a linha da área.

**Não reorganizar em pastas** (por exigência das ferramentas):
- `src/routes`: o nome do arquivo vira o endereço do site. Mover um arquivo muda o link e quebra os que já existem.
- `supabase/functions`: cada função fica em uma pasta própria, no mesmo nível das outras.
- `drizzle/migrations`: fila em ordem numérica, registrada em `meta/_journal.json`. Nunca editar uma migração já aplicada; criar uma nova.
- O Lovable sincroniza o repositório. Mover muitos arquivos de uma vez gera conflito, sem ganho para o cliente.

Convenções: telas ficam em `src/routes` (logadas em `src/routes/_authenticated`), regras e acesso ao banco em `src/lib` (cada `x.ts` tem `x.test.ts` ao lado), peças de tela em `src/components`, componentes base em `src/components/ui`. Os tipos do banco gerados ficam em `src/integrations/supabase`.

## Áreas

### Entrada, conta e termos
| | Onde está |
|---|---|
| Telas | `auth.tsx`, `termos.tsx`, `privacidade.tsx`, `_authenticated/route.tsx` (porta das telas logadas) |
| Peças | `components/TermsGate.tsx`, `LegalPage.tsx` |
| Regras | `lib/auth.tsx`, `auth-errors.ts`, `after-login.ts` (volta ao destino depois de entrar), `legal.ts`, `username.ts`, `cpf.ts` |
| Banco | `handle_new_user`, `accept_terms`, `current_terms_version`, `delete_my_account`, `export_my_data` |

### Vagas (publicar, achar, interessados)
| | Onde está |
|---|---|
| Telas | `_authenticated/publicar.tsx`, `vagas.index.tsx`, `vagas.$profissao.$codigo.index.tsx`, `...interessados.tsx`, `minhas-vagas.tsx`, `v.$codigo.tsx` (link curto) |
| Peças | `components/PostCard.tsx`, `PostActions.tsx`, `PostFormFields.tsx`, `PostEditDialog.tsx`, `PostEditorHost.tsx`, `NewPostButton.tsx`, `PhotoGallery.tsx`, `ClosedOffers.tsx`, `CatalogPicker.tsx` |
| Regras | `lib/post-*.ts` (formulário, código, fotos, aparência, lacunas), `my-jobs.ts`, `interest.ts`, `catalog.ts`, `discovery.ts`, `geo.ts`, `location.ts` |
| Banco | tabelas `posts`, `post_photos`, `post_locations`, `post_waitlist`, `professions`, `sectors`; funções `search_post_ids`, `set_post_slug`, `my_post_distances`, `join_waitlist`, `check_post_catalog` |

### Serviços (páginas públicas para o Google)
| | Onde está |
|---|---|
| Telas | `servicos.index.tsx`, `servicos.$profissao.index.tsx`, `servicos.$profissao.$cidade.tsx` |
| Peças | `components/ServiceListing.tsx` |
| Regras | `lib/services.ts`, `services-hooks.ts`, `service-pages.ts`, `seo.ts` |
| Banco | tabela `services` |

### Perfil, habilidades e verificação
| | Onde está |
|---|---|
| Telas | `_authenticated/perfil.index.tsx`, `perfil.$slug.tsx`, `perfil.contato.tsx`, `perfil.verificacao.tsx`, `verificacoes.tsx` (fila da equipe), `c.$usuario.tsx` (link curto) |
| Peças | `components/profile-bits.tsx`, `ProfileDialogs.tsx`, `SkillDialog.tsx`, `WorkAreaDialog.tsx`, `VerificationCard.tsx`, `Seal.tsx`, `PrivacyCard.tsx` |
| Regras | `lib/skills.ts`, `verification.ts`, `contact.ts`, `badges.ts`, `username.ts` |
| Banco | `profiles`, `profile_skills`, `profile_private`, `work_areas`, `contact_phones`, `contact_addresses`, `identity_verifications`, `user_checks`, `reviews`; `review_verification`, `set_profile_slug`, `public_city` |

### Conversas e negociações
| | Onde está |
|---|---|
| Telas | `_authenticated/conversas.tsx`, `conversas.index.tsx`, `conversas.$slug.tsx` |
| Peças | `components/InboxList.tsx`, `ConversationMenu.tsx`, `MessageStatus.tsx`, `EngagementCard.tsx`, `ContactDialogs.tsx` |
| Regras | `lib/chat.ts`, `chat-hooks.ts`, `conversation-prefs.ts`, `sound.ts` (regras de negociação testadas em `negotiations.test.ts`) |
| Banco | `conversations`, `messages`, `conversation_reads`, `conversation_prefs`, `engagements`, `user_presence`; `open_conversation`, `unread_counts`, `respond_engagement`, `close_negotiation`, `enforce_chat_limit` |
| Automático | `cleanup-chat-files` (apaga anexos do chat com 48 h) |

### Comunidade e canais
| | Onde está |
|---|---|
| Telas | `_authenticated/comunidade.index.tsx`, `comunidade.grupos.tsx`, `canais.index.tsx`, `canais.$slug.tsx`, `canais.novo.tsx` |
| Peças | `components/CommunityPostCard.tsx`, `ChannelForm.tsx` |
| Regras | `lib/community.ts`, `channels.ts` |
| Banco | `channels`, `channel_follows`, `channel_professions`, `community_members`, `conversation_posts`; `community_overview`, `channel_overview`, `notify_channel_followers` |

### Blog
| | Onde está |
|---|---|
| Telas | `blog.index.tsx`, `blog.$slug.tsx` (públicas), `_authenticated/meus-artigos.tsx`, `escrever.$id.tsx`, `revisar-artigos.tsx` (equipe) |
| Peças | `components/blog/ArticleEditor.tsx` (editor), `ArticleView.tsx` (leitura, assinatura, cartão), `Engagement.tsx` (curtir, comentários, visualizações) |
| Regras | `lib/blog.ts` (acesso ao banco), `blog-html.ts` (filtro de segurança do HTML) |
| Banco | `articles`, `article_views`, `article_likes`, `article_comments`; `blog_list`, `blog_article`, `submit_article`, `review_article`, `record_article_view`, `toggle_article_like`, `add_article_comment`; pasta de fotos `blog` |
| Migrações | `0057_blog`, `0061_blog_interacao` |
| Regra de negócio | só Premium escreve; tudo passa pela aprovação da equipe |

### Planos, pagamento e indicações
| | Onde está |
|---|---|
| Telas | `_authenticated/plano.tsx`, `checkout.tsx`, `pagamento.tsx` |
| Peças | `components/CheckoutButton.tsx`, `PayPanel.tsx`, `ReferralCard.tsx`, `HoldBanner.tsx` |
| Regras | `lib/plans.ts`, `billing.ts`, `referrals.ts` |
| Banco | `subscriptions`, `payments`, `asaas_customers`, `referrals`, `referral_rewards`; `asaas_apply_payment`, `is_premium`, `grant_premium_days`, `evaluate_referrals` |
| Automático | funções `asaas-checkout`, `asaas-cancel`, `asaas-webhook`, `referral-rewards`; tarefa `beecos-indicacoes`, `beecos-indicacoes-asaas` |
| Guia | `docs/asaas.md` |

### Avisos, e-mails e notificações no celular
| | Onde está |
|---|---|
| Telas | `_authenticated/avisos.tsx` |
| Peças | `components/AlertPrefsCard.tsx`, `PushToggle.tsx`, `InstallPrompt.tsx` |
| Regras | `lib/alerts.ts`, `push.ts`, `pwa.ts` |
| Banco | `notifications`, `notification_prefs`, `email_outbox`, `push_outbox`, `push_subscriptions`; `queue_email`, `queue_push`, `push_on_notification`, `claim_emails`, `claim_pushes` |
| Automático | funções `send-emails`, `send-push`; tarefas `beecos-emails-*`, `beecos-push-envio` |

### Gestão, moderação e denúncias
| | Onde está |
|---|---|
| Telas | `_authenticated/admin.tsx`, `moderacao.tsx`, `verificacoes.tsx`, `sugestoes.tsx`, `revisar-artigos.tsx` |
| Peças | `components/AdminMenu.tsx` (menu lateral da Gestão), `ModerationCase.tsx`, `ModeratorShortcut.tsx`, `ReportButton.tsx` |
| Regras | `lib/admin.ts`, `reports.ts`, `suggestions.ts` |
| Banco | `moderators`, `admin_actions`, `moderator_access_log`, `reports`, `blocked_terms`, `account_holds`, `audit_holds`, `suggestions`; `admin_guard`, `admin_overview`, `resolve_report`, `moderator_case`, `is_moderator` |

### Anúncios, cookies e medição
| | Onde está |
|---|---|
| Peças | `components/AdSlot.tsx`, `CookieBanner.tsx`, `GoogleAdsTag.tsx` |
| Regras | `lib/ads.ts`, `google-ads.ts`, `consent.ts`, `consent-defaults.ts`, `ad-consent.ts` |
| Banco | tabela `ads` |
| Regra de negócio | tag e conversões só passam por `google-ads.ts`, atrás do aviso de cookies |

### Início, ajuda, tutorial e sugestões
| | Onde está |
|---|---|
| Telas | `index.tsx`, `ajuda.tsx` |
| Peças | `components/HomeBanner.tsx`, `WelcomeTour.tsx` (tutorial de boas-vindas), `SuggestionButton.tsx`, `AssistedHelp.tsx`, `AppShell.tsx` (cabeçalho, menu, rodapé), `SettingsMenu.tsx`, `SettingsFrame.tsx` |
| Regras | `lib/tour.ts`, `help.ts` (perguntas e respostas da Ajuda), `theme.ts` |

### Sitemap e busca (SEO)
| | Onde está |
|---|---|
| Tela | `sitemap[.]xml.ts` |
| Regras | `lib/sitemap.ts`, `sitemap-dynamic.ts`, `seo.ts`, `urls.ts` (`SITE_URL` = https://beecos.com.br) |

## Tarefas automáticas (pg_cron)
`beecos-emails-mensagens`, `beecos-emails-envio`, `beecos-push-envio`, `beecos-indicacoes`, `beecos-indicacoes-asaas`, `beecos-anexos-48h`, `beecos-emails-premium-fim`, `beecos-emails-vagas`, `beecos-limpar-guarda`, `beecos-limpar-historico`.
Chamam as funções do servidor por `public.call_internal_function`, e só quando há trabalho (migração `0060_cron_economia`).

## Regras que não se quebram
- Cidade em público sempre passa por `publicCity()` (`lib/location.ts`) ou `public_city()` no banco.
- Funções internas (`send-emails`, `send-push`, `cleanup-chat-files`, `referral-rewards`) só rodam com a chave interna; texto de usuário passa por `safeUserText` antes de sair por e-mail ou push.
- O sitemap lê só o que o visitante já pode ver (chave pública, nunca a de serviço).
- Ação que apaga ou altera pede confirmação "Tem certeza que deseja…?" (`lib/confirm.ts`).
- Nada de segredo no chat, no código ou no repositório: chaves só pelo formulário seguro do Lovable.
- Visual: blocos com borda preta e sombra de bloco são a identidade; cabeçalho não muda por setor.
