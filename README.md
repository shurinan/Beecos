# Beecos

Um app de serviços destinado ao trabalhador braçal. Onde o contratante e um contratado podem negociar entre si por meio de chat.

O usuário também pode criar um perfil mostrando suas habilidades e postar que está disponivel para trabalhar e colocar vagas tambem

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://beecos.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bb9ff851-ab18-4101-be04-68ed2df84c16).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Anúncios

O app tem dois espaços discretos de publicidade: um no feed (depois do 4º item, só se houver mais itens) e um no fim do perfil público. Eles não aparecem no chat nem nos formulários, e usuários Premium não veem anúncios. Sem anúncio ativo, o espaço não ocupa lugar nenhum.

Os anúncios ficam na tabela `ads` e só quem tem acesso ao banco (painel do Supabase ou `service_role`) cadastra e edita; usuários só leem os ativos.

```sql
INSERT INTO public.ads (placement, sponsor, title, body, image_url, link_url)
VALUES ('feed', 'Loja Exemplo', 'Ferramentas com 10% off', 'Para quem trabalha pesado', 'https://exemplo.com/logo.png', 'https://exemplo.com');
```

- `placement`: `feed` ou `profile`.
- `active`, `starts_at` e `ends_at` controlam quando o anúncio aparece.
- `link_url` aceita só `http(s)`; `image_url` só `https`.

## Habilidades

Em "Meu perfil", o botão **Adicionar** abre o formulário de habilidade: nome, nível de competência (Quase profissional: pouca supervisão; Profissional: sem supervisão; Especialista: pode treinar outros), três perguntas Sim/Não (experiência profissional, treinamento ou aulas, licenciado/certificado) e "Outras informações". No perfil público, cada habilidade aparece como um cartão com o nível, os selos respondidos "Sim" e as observações.

Tudo é informado pelo próprio profissional e o perfil diz isso; o app não verifica documentos. A confiança vem das avaliações, que só podem ser feitas por quem conversou com a pessoa (os dois enviaram mensagem).

## Perfil em camadas

- **Visão geral** (`/painel`): cabeçalho com foto, resumo do contato e as habilidades.
- **Habilidades**: cada habilidade tem nível, anos de experiência, treinamento, certificado e observações (migration `0006`).
- **Contato** (`/contato`): foto de perfil, informações pessoais, autorização de uso dos dados, e-mail, telefones por tipo e endereços físico/postal (migrations `0007` e `0008`).

Tudo do menu de contato é privado (RLS: só o dono lê e escreve). Só a foto (bucket público `avatars`) e o nome preferido aparecem no perfil público.

Antes de publicar este código, aplique as migrations `0006` a `0010` no banco: o Lovable não aplica as migrations do repositório sozinho.

O texto da autorização de uso dos dados está em `src/lib/contact.ts` (`CONSENT_TEXT`) e deve ser revisado por quem cuida da parte jurídica. Quando o texto mudar, troque `CONSENT_VERSION`.

## Chat

- **Não lidas**: contador no menu "Conversas", selo em cada conversa, "(3) Beecos" na aba do navegador e faixa "Novas mensagens" ao abrir. A leitura fica em `conversation_reads`.
- **Avisos**: com o app aberto, um aviso na tela; com o app em segundo plano, notificação do sistema (a pessoa ativa em Conversas > "Ativar avisos"). Aviso com o app totalmente fechado exige envio por servidor (Web Push, com chaves VAPID guardadas como segredo): o `public/sw.js` já tem o tratamento do evento `push`, falta só o envio.
- **Presença**: "online", "digitando…" e "visto há X" (só entre quem já conversou, e a pessoa pode desligar em Informações de contato > Privacidade no chat). "Responde rápido" vem da mediana de resposta (`reply_stats`) e só aparece com 3 respostas ou mais.
- **Anexos**: imagem (JPG, PNG, WebP) ou PDF de até 2 MB, em bucket privado `chat-files`, acessível só aos dois da conversa por link temporário. O bucket e a tabela recusam outros tipos e tamanhos.
- **Moderação**: a tabela `blocked_terms` é aplicada por gatilhos do banco em mensagens, nome do anexo, publicações, avaliações, perfil e habilidades. Ignora acentos, maiúsculas, números no lugar de letras e letras repetidas. A lista inicial é um ponto de partida: para ajustar, use `INSERT`/`DELETE` em `blocked_terms`, sem mexer no código.

## App instalável (PWA)

`public/manifest.webmanifest`, ícones e `public/sw.js`. O service worker só é registrado no site publicado, não guarda páginas em cache (ninguém fica preso numa versão antiga) e mostra uma tela de "sem internet". No Android e no computador aparece o botão "Instalar"; no iPhone, a instrução de "Adicionar à Tela de Início".

## Serviços (escolher, aceitar, concluir)

- **Vaga** (`job`): quem publica define quantas pessoas precisa (`posts.vacancies`) e **escolhe** entre os interessados, na página `/publicacao/<id>` ("Interessados", numerados pela ordem de chegada) ou no cartão do serviço dentro da conversa. **Oferta** (`available`): quem se interessa **contrata**.
- Só dá para escolher quem já respondeu na conversa. Escolher não fecha o trato: o prestador **aceita ou recusa**; recusar libera a vaga. Depois de aceito, **qualquer um dos dois marca como concluído**. Cada etapa vira um aviso no histórico da conversa.
- **Avaliação só depois de concluído** (`can_review` consulta `engagements`), nos dois sentidos.
- **Contatos**: cada telefone tem a opção "mostrar para quem conversa comigo" (marcada ao cadastrar, pode desmarcar). Só quem já trocou mensagens com a pessoa (os dois lados escreveram) vê, no perfil dela, com botões de WhatsApp, ligar e SMS. E-mail e endereço nunca são compartilhados.
- Migration `0010`. As mudanças de estado passam só pelas funções `choose_provider`, `respond_engagement`, `complete_engagement` e `cancel_engagement`; a tabela `engagements` é só de leitura para o app.
