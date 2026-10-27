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
          Somos um ponto de encontro: publicamos vagas e perfis e oferecemos chat. <b>Não somos
          parte</b> do serviço combinado entre vocês, não empregamos ninguém e não garantimos a
          qualidade, o preço nem o pagamento de um serviço.
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
        Qualquer pessoa pode denunciar uma vaga ou um perfil. Nenhuma denúncia bloqueia nada
        automaticamente: uma pessoa da moderação avalia cada caso e pode ocultar uma publicação que
        descumpra estas regras. Contas com abuso repetido podem ser suspensas.
      </p>

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
        Você pode excluir sua conta quando quiser, no seu perfil, em “Privacidade e dados”. Podemos
        suspender ou encerrar contas que violem estes termos.
      </p>

      <h2>Mudanças</h2>
      <p>
        Se estes termos mudarem de forma relevante, pediremos que você leia e aceite de novo. O uso
        do Beecos é regido pelas leis do Brasil.
      </p>
    </LegalPage>
  );
}
