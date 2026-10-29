# Pagamentos pelo Asaas

Duas coisas são vendidas: **Premium** (assinatura mensal, R$ 14,90) e **selo Urgente avulso** (R$ 2 por vaga).

## Peças
| Peça | Onde | O que faz |
|---|---|---|
| `asaas-checkout` | supabase/functions | Cria o cliente e a cobrança no Asaas e devolve o link de pagamento. Exige login. |
| `asaas-webhook` | supabase/functions | Recebe os avisos do Asaas e libera/retira o Premium e o Urgente. Exige o token no cabeçalho `asaas-access-token`. |
| `asaas-cancel` | supabase/functions | Cancela a assinatura; devolve o valor se a 1ª cobrança foi paga há até 7 dias. Exige login. |
| `payments`, `asaas_customers` | migração 0038 | Registro dos pagamentos e ligação pessoa ↔ cliente do Asaas. O CPF nunca é guardado aqui. |

## Segredos (Lovable Cloud → Secrets)
- `ASAAS_API_KEY`: chave de API do Asaas (começa com `$aact_`).
- `ASAAS_ENV`: `sandbox` (testes) ou `production`.
- `ASAAS_WEBHOOK_TOKEN`: um texto longo e aleatório (32+ caracteres) que você inventa; o mesmo vai no painel do Asaas.

## Webhook no Asaas
URL: `https://qfheectjquxfgmexahem.supabase.co/functions/v1/asaas-webhook`
Token de autenticação: o mesmo `ASAAS_WEBHOOK_TOKEN`. Versão da API: v3. Eventos: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_DELETED`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`.

## Regras
- Pagou → Premium por +1 mês a partir do fim do período atual (ou de agora). O mesmo aviso repetido não estende duas vezes.
- Devolveu ou chargeback → Premium termina na hora (Urgente: o selo sai da vaga).
- Cancelar → o Asaas para de cobrar; o Premium vai até o fim do período pago.
- Premium vitalício (sem data de fim) nunca é alterado pelo webhook.

## Telas
- `/checkout?tipo=premium` ou `?tipo=urgente&vaga=<id>`: resumo do pedido, CPF (só na primeira vez), aceite dos Termos e botão para o Asaas.
- `/pagamento?tipo=premium|urgente`: "Pagamento confirmado!" (confere o banco a cada 3 s por 2 minutos).
- Para o Asaas trazer a pessoa de volta a `/pagamento` depois de pagar, crie o segredo `ASAAS_SUCCESS_URL` com o endereço do site (ex.: `https://beecos.com.br`). O domínio precisa estar cadastrado na conta do Asaas; sem o segredo, a pessoa volta pelo navegador.

## Plano anual
R$ 149 em pagamento único (cobrança avulsa, `externalReference = annual:<pessoa>`), vale 12 meses e não renova sozinho. Equivale a 10 meses do mensal: economia de 1 − 149/178,80 = 16,7% (mostrado como 17%). Desistência em até 7 dias devolve o valor (botão em Meu perfil). Quem tem mensal ativo precisa cancelar antes; anual com mais de 30 dias pela frente não compra outro.
Parcelamento no cartão: depende da configuração de parcelas da conta no Asaas (ver Configurações da conta no painel); o app não calcula juros.
