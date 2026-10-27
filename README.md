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
