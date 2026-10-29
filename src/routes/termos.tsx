import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Beecos" },
      { name: "description", content: "As regras para usar o Beecos." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Termos de uso">
      <p>
        O Beecos é uma plataforma que aproxima quem precisa de um serviço de quem sabe fazê-lo. Ao
        criar uma conta, você concorda com estas regras.
      </p>

      <h2>O que o Beecos é (e não é)</h2>
      <ul>
        <li>
          Somos um ponto de encontro: publicamos vagas e perfis e oferecemos chat.{" "}
          <b>Não somos parte</b> do serviço combinado entre vocês, não empregamos ninguém e não
          garantimos a qualidade, o preço nem o pagamento de um serviço.
        </li>
        <li>
          O preço, o horário e as condições são combinados diretamente no chat, entre as duas
          pessoas.
        </li>
      </ul>

      <h2>Sua conta</h2>
      <ul>
        <li>Você precisa ter 18 anos ou mais e informar dados verdadeiros.</li>
        <li>O nome de usuário é único e vira o endereço do seu perfil.</li>
        <li>Você é responsável pelo que publica e pela segurança da sua senha.</li>
      </ul>

      <h2>O que não pode</h2>
      <ul>
        <li>Golpes, pedidos de dinheiro adiantado ou qualquer forma de enganar outras pessoas.</li>
        <li>Ofensas, assédio, discriminação ou conteúdo ilegal.</li>
        <li>Publicar vagas ou perfis falsos, ou se passar por outra pessoa.</li>
        <li>Usar o chat para spam ou para levar a conversa para fora do app com más intenções.</li>
        <li>Tentar burlar os limites do plano ou acessar dados de outras pessoas.</li>
      </ul>

      <h2>Denúncias e moderação</h2>
      <p>
        Qualquer pessoa pode denunciar uma vaga ou um perfil. Uma pessoa da moderação avalia cada
        caso e pode ocultar uma publicação que descumpra estas regras. Contas com abuso repetido
        podem ser suspensas.
      </p>
      <ul>
        <li>
          <b>Vigilância de 2 horas nas duas contas.</b> Assim que uma denúncia é enviada, a conta de
          quem denunciou e a conta de quem foi denunciado ficam em vigilância por 2 horas: nesse
          período não é possível negociar, publicar vagas nem receber propostas, e as duas contas
          veem um aviso. É uma medida de cuidado enquanto o caso é analisado, não uma punição nem
          uma decisão sobre quem tem razão. Se a moderação descartar a denúncia, a vigilância é
          encerrada na hora.
        </li>
        <li>
          <b>Análise do caso.</b> Para avaliar uma denúncia, a moderação pode ver a publicação ou o
          perfil denunciado, as informações básicas das duas contas, outras publicações do
          denunciado e a conversa entre as duas pessoas (inclusive os arquivos enviados nela). Nada
          além disso é aberto, a moderação não entra na conta de ninguém, e cada acesso fica
          registrado.
        </li>
        <li>
          <b>Guarda por 7 dias só quando há denúncia.</b> Se a sua conta fez ou recebeu uma
          denúncia, o que for apagado (publicações, mensagens, conversas, avaliações e dados básicos
          da conta) fica guardado de forma protegida por 7 dias, só para a moderação auditar o caso;
          depois disso é apagado. Sem denúncia, o que você apaga é apagado de vez.
        </li>
        <li>
          <b>Má-fé.</b> Denunciar alguém só para prejudicar é proibido. A moderação pode marcar uma
          denúncia como de má-fé; quem tiver duas denúncias assim em 90 dias perde o direito de
          denunciar e pode ter a conta encerrada.
        </li>
      </ul>

      <h2>Planos e pagamentos</h2>
      <ul>
        <li>
          O plano Grátis tem limites mensais de vagas publicadas e de novas conversas. O Premium
          remove esses limites e inclui os benefícios listados na página de planos. Alguns recursos
          também podem ser comprados avulsos, como o selo Urgente numa vaga.
        </li>
        <li>
          O Premium pode ser mensal (cobrado todo mês) ou anual (pagamento único de R$ 149, válido
          por 12 meses, que não renova sozinho). Antes de pagar, você vê o valor, a forma de
          pagamento e, no mensal, quando a próxima cobrança acontece. O pagamento é processado pelo
          Asaas.
        </li>
        <li>
          <b>Arrependimento em 7 dias:</b> você pode desistir de uma compra em até 7 dias corridos
          depois de pagar e receber o valor de volta, sem custo (Código de Defesa do Consumidor,
          art. 49).
        </li>
        <li>
          <b>Cancelamento:</b> use “Cancelar assinatura” em Meu perfil › Seu plano, quando quiser. O
          Premium continua até o fim do período já pago e não é cobrado de novo. O plano anual não
          renova sozinho; dentro dos 7 dias, a desistência é feita no mesmo lugar.
        </li>
      </ul>

      <h2>O que você publica</h2>
      <p>
        O conteúdo que você publica (textos, fotos e avaliações) continua sendo seu. Ao publicar,
        você autoriza o Beecos a exibi-lo no app enquanto ele estiver publicado. Você pode apagar o
        que publicou a qualquer momento. Se algo publicado por outra pessoa violar um direito seu,
        denuncie no app ou escreva para o nosso contato.
      </p>
      <p>
        Fotos e PDFs enviados no chat ficam disponíveis por 48 horas e depois são apagados; o texto
        da conversa continua.
      </p>

      <h2>Responsabilidade</h2>
      <p>
        O Beecos aproxima as pessoas, mas não presta, não fiscaliza e não garante os serviços
        combinados entre elas. Cada pessoa responde pelo que publica, pelo que combina e pelo
        serviço que presta ou contrata. Fazemos o possível para manter o app no ar e seguro, mas ele
        pode ficar fora do ar por manutenção ou por falhas que não controlamos.
      </p>

      <h2>Avaliações</h2>
      <p>
        Só quem concluiu um serviço com outra pessoa pode avaliá-la. As avaliações são opiniões de
        quem as escreveu e podem ser denunciadas.
      </p>

      <h2>Encerrar a conta</h2>
      <p>
        Você pode excluir sua conta quando quiser, no seu perfil, em “Privacidade e dados”. Sem
        denúncia, tudo é apagado; com denúncia, vale a guarda de 7 dias da seção “Denúncias e
        moderação”. Podemos suspender ou encerrar contas que violem estes termos.
      </p>

      <h2>Mudanças</h2>
      <p>
        Se estes termos mudarem de forma relevante, pediremos que você leia e aceite de novo. O uso
        do Beecos é regido pelas leis do Brasil, e você pode recorrer ao foro do seu domicílio.
        Contato: {PRIVACY_CONTACT_EMAIL}.
      </p>
    </LegalPage>
  );
}
