import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

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
          <b>O que é apagado fica guardado.</b> Publicações, mensagens, conversas, avaliações e
          contas apagadas por você não somem por completo: uma cópia fica guardada de forma
          protegida, só para a moderação, para apurar denúncias, prevenir fraudes, cumprir
          obrigações legais e nos defender em caso de disputa. Essas cópias não aparecem para outras
          pessoas e são mantidas pelo tempo necessário a essas finalidades.
        </li>
      </ul>

      <h2>Planos</h2>
      <p>
        O plano Grátis tem limites mensais de vagas publicadas e de novas conversas. O plano Premium
        remove esses limites e inclui os benefícios descritos na página de planos. Os valores e as
        condições de cobrança serão informados antes de qualquer pagamento.
      </p>

      <h2>Avaliações</h2>
      <p>
        Só quem concluiu um serviço com outra pessoa pode avaliá-la. As avaliações são opiniões de
        quem as escreveu e podem ser denunciadas.
      </p>

      <h2>Encerrar a conta</h2>
      <p>
        Você pode excluir sua conta quando quiser, no seu perfil, em “Privacidade e dados”. O que
        for apagado fica guardado nos termos da seção “Denúncias e moderação”. Podemos suspender ou
        encerrar contas que violem estes termos.
      </p>

      <h2>Mudanças</h2>
      <p>
        Se estes termos mudarem de forma relevante, pediremos que você leia e aceite de novo. O uso
        do Beecos é regido pelas leis do Brasil.
      </p>
    </LegalPage>
  );
}
