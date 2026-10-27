import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Beecos" },
      { name: "description", content: "Como o Beecos trata os seus dados pessoais (LGPD)." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Política de privacidade">
      <p>
        Aqui explicamos, sem juridiquês, quais dados o Beecos guarda, para quê e quais são os seus
        direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2>Quais dados guardamos</h2>
      <ul>
        <li>
          <b>Conta:</b> e-mail, nome, nome de usuário e senha (a senha é guardada de forma
          protegida; nós não a vemos). Se você entrar com o Google, recebemos nome e e-mail dessa
          conta.
        </li>
        <li>
          <b>Perfil:</b> foto, cidade, apresentação, habilidades e experiência que você escolher
          preencher.
        </li>
        <li>
          <b>Contato:</b> telefone e endereço, se você cadastrar. Ficam guardados com proteção e só
          são mostrados a outra pessoa se você os compartilhar.
        </li>
        <li>
          <b>Localização aproximada:</b> o CEP do lugar onde você atua e o CEP das vagas que você
          publica, transformados em um ponto no mapa só para calcular distâncias e enviar avisos. O
          endereço da vaga <b>nunca é mostrado</b> a outras pessoas; elas veem apenas a distância.
        </li>
        <li>
          <b>Uso:</b> vagas, conversas e mensagens, avaliações, avisos recebidos, preferências, plano
          e o horário em que você esteve online pela última vez.
        </li>
        <li>
          <b>Denúncias:</b> as que você enviar e as que forem feitas sobre você, com a decisão da
          moderação.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Fazer o app funcionar: criar sua conta, mostrar vagas e perfis, permitir o chat.</li>
        <li>Calcular a distância e avisar sobre vagas da sua profissão perto de você.</li>
        <li>Cuidar da segurança, prevenir golpes e avaliar denúncias.</li>
        <li>Cobrar o plano Premium, quando o pagamento estiver disponível.</li>
      </ul>
      <p>
        As bases legais são a execução do contrato (o uso do app), o seu consentimento (por exemplo,
        a localização e os contatos que você escolhe informar), o nosso interesse legítimo em
        segurança e o cumprimento de obrigações legais.
      </p>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>
          <b>Outras pessoas do app:</b> só o que o seu perfil e as suas vagas mostram, e os contatos
          que você decidir compartilhar numa conversa.
        </li>
        <li>
          <b>Empresas que nos prestam serviço:</b> hospedagem e banco de dados (Supabase e Lovable);
          login com Google, se você usar; e, quando forem ativados, pagamento (Asaas) e e-mail
          (Resend). Elas só tratam os dados para nos prestar o serviço.
        </li>
        <li>
          <b>Autoridades,</b> quando a lei exigir.
        </li>
      </ul>
      <p>Não vendemos os seus dados. Os anúncios exibidos são do próprio Beecos.</p>

      <h2>Cookies e armazenamento</h2>
      <p>
        Usamos apenas o que é necessário: manter você conectado e lembrar do tema claro ou escuro.
        Não usamos cookies de publicidade nem de rastreamento.
      </p>

      <h2>Por quanto tempo</h2>
      <p>
        Guardamos os dados enquanto a sua conta existir. Ao excluir a conta, o seu perfil, as suas
        vagas, conversas e demais dados são apagados. Cópias de segurança podem demorar um pouco
        mais para sumir, e podemos manter o que a lei exigir.
      </p>

      <h2>Os seus direitos</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>
          <b>Acessar e levar os seus dados:</b> em Perfil › Privacidade e dados › “Baixar meus
          dados”.
        </li>
        <li>
          <b>Corrigir:</b> editando o seu perfil e os seus contatos.
        </li>
        <li>
          <b>Excluir a conta e os dados:</b> em Perfil › Privacidade e dados › “Excluir minha
          conta”.
        </li>
        <li>
          <b>Pedir informações</b> sobre o tratamento, revogar consentimentos ou contestar uma
          decisão, falando com o nosso canal de privacidade.
        </li>
      </ul>

      <h2>Crianças e adolescentes</h2>
      <p>O Beecos é para maiores de 18 anos.</p>

      <h2>Fale com a gente</h2>
      <p>
        {PRIVACY_CONTACT_EMAIL ? (
          <>
            Canal de privacidade: <a className="font-bold underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
          </>
        ) : (
          "O e-mail do nosso canal de privacidade será divulgado aqui. Enquanto isso, os pedidos de acesso, correção e exclusão podem ser feitos direto no seu perfil."
        )}{" "}
        Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>
    </LegalPage>
  );
}
