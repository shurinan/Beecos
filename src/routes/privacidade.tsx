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
          <b>Contato:</b> telefone, endereço e data de nascimento, se você cadastrar. Ficam
          guardados com proteção e só são mostrados a outra pessoa se você os compartilhar. A data
          de nascimento é opcional e fica visível só para você.
        </li>
        <li>
          <b>Localização aproximada:</b> o CEP do lugar onde você atua e o CEP das vagas que você
          publica, transformados em um ponto no mapa só para calcular distâncias e enviar avisos. O
          endereço da vaga <b>nunca é mostrado</b> a outras pessoas; elas veem apenas a distância.
        </li>
        <li>
          <b>Uso:</b> vagas e as fotos delas, conversas e mensagens, arquivos enviados no chat,
          avaliações, avisos recebidos, preferências, plano e o horário em que você esteve online
          pela última vez.
        </li>
        <li>
          <b>Denúncias:</b> as que você enviar e as que forem feitas sobre você, com a decisão da
          moderação. Quando há uma denúncia, a moderação pode ver a publicação ou o perfil
          denunciado, dados básicos das duas contas e a conversa entre as duas pessoas, com registro
          de cada acesso, e as duas contas ficam 2 horas em vigilância.
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
          <b>Empresas que nos prestam serviço:</b> hospedagem, banco de dados e relatório de erros
          do app (Supabase e Lovable); login com Google, se você usar; as fontes de letra do site
          (Google Fonts, que recebe o seu endereço IP ao carregar a página); a busca do CEP e da
          cidade (BrasilAPI e OpenStreetMap, que recebem o CEP digitado); pagamento (Asaas) e e-mail
          (Resend). Elas só tratam os dados para nos prestar o serviço. Ao pagar, o Asaas pede o seu
          CPF: ele fica com o Asaas e o Beecos não o guarda.
        </li>
        <li>
          <b>Autoridades,</b> quando a lei exigir.
        </li>
      </ul>
      <p>Não vendemos os seus dados. Os anúncios exibidos são do próprio Beecos.</p>
      <p>
        Alguns desses serviços guardam dados em servidores fora do Brasil. Nesses casos, usamos
        empresas que oferecem proteção adequada aos dados, como pede a LGPD (art. 33).
      </p>

      <h2>Cookies e armazenamento</h2>
      <p>
        Usamos apenas o que é necessário: manter você conectado e lembrar do tema claro ou escuro.
        Não usamos cookies de publicidade nem de rastreamento.
      </p>

      <h2>Por quanto tempo</h2>
      <ul>
        <li>Guardamos os dados enquanto a sua conta existir.</li>
        <li>
          Fotos e PDFs enviados no chat ficam 48 horas e depois são apagados. O texto das mensagens
          continua na conversa.
        </li>
        <li>
          Ao excluir a conta, ou algo que você publicou, tudo é apagado de vez, inclusive as fotos.
        </li>
        <li>
          <b>Exceção, só quando há denúncia:</b> se a sua conta fez ou recebeu uma denúncia, o que
          for apagado fica guardado de forma protegida por 7 dias, acessível apenas à moderação,
          para auditar o caso. Depois disso, é apagado.
        </li>
        <li>Cópias de segurança do banco de dados podem demorar um pouco mais para sumir.</li>
      </ul>

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
            Canal de privacidade:{" "}
            <a className="font-bold underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
              {PRIVACY_CONTACT_EMAIL}
            </a>
            .
          </>
        ) : (
          "Os pedidos de acesso, correção e exclusão podem ser feitos direto no seu perfil."
        )}{" "}
        Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>
    </LegalPage>
  );
}
