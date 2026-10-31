import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Guide = { id: string; title: string; text: string; tips: string[] };

const GUIDES: Guide[] = [
  {
    id: "obras-e-reformas",
    title: "Obras e reformas",
    text: "Pedreiro, pintor, azulejista, gesseiro e ajudante. ",
    tips: [
      "Descreva o serviço com medidas aproximadas e peça fotos de trabalhos anteriores.",
      "Combine o que está incluso: material, limpeza final e prazo.",
      "Para obras maiores, divida o pagamento em etapas e deixe por escrito.",
    ],
  },
  {
    id: "eletrica",
    title: "Elétrica",
    text: "Instalação de tomadas, chuveiros, ventiladores e luminárias, troca de disjuntor e reparos. ",
    tips: [
      "Pergunte se o profissional tem experiência com o tipo de instalação que você precisa.",
      "Desligue o disjuntor geral antes de qualquer visita e não improvise com fios expostos.",
      "Para quadro de luz e carga alta, procure quem tenha formação e registre o serviço.",
    ],
  },
  {
    id: "encanamento",
    title: "Encanamento",
    text: "Vazamentos, desentupimento, troca de torneiras, sifões e registros, caixa d'água. ",
    tips: [
      "Feche o registro geral enquanto espera o profissional, se houver vazamento.",
      "Peça para ver o defeito antes de aprovar a troca de peças.",
      "Combine o valor da visita e do conserto antes de começar.",
    ],
  },
  {
    id: "limpeza",
    title: "Limpeza",
    text: "Diarista, limpeza pós-obra, faxina pesada e limpeza de caixa d'água, sofá e estofados.",
    tips: [
      "Informe tamanho do imóvel, número de cômodos e o que precisa ser feito.",
      "Combine quem leva os produtos e os equipamentos.",
      "Veja as avaliações de quem já contratou e confirme dia e horário por mensagem.",
    ],
  },
  {
    id: "mudancas-e-fretes",
    title: "Mudanças e fretes",
    text: "Carretos, mudanças, montagem e desmontagem de móveis, ajudantes de carga.",
    tips: [
      "Informe origem, destino, escadas, elevador e itens grandes para receber um valor justo.",
      "Pergunte sobre cuidado com os móveis e se há cobrança por hora extra.",
      "Evite pagar tudo adiantado a quem você não conhece.",
    ],
  },
  {
    id: "saude",
    title: "Saúde e cuidados",
    text: "Cuidadores, acompanhantes e profissionais da área da saúde. Cuidar de pessoas pede confiança e, em alguns casos, registro profissional.",
    tips: [
      "Procedimentos de saúde, como curativos e medicação, precisam de profissional habilitado.",
      "Peça referências e converse antes de começar.",
      "Defina horários, tarefas e valor por escrito.",
    ],
  },
  {
    id: "beleza",
    title: "Beleza",
    text: "Barbeiros, cabeleireiros, manicures e maquiadores, no salão ou em domicílio.",
    tips: [
      "Veja fotos do trabalho e combine o serviço antes de marcar.",
      "Pergunte sobre o preço e o tempo estimado.",
      "Confirme o endereço e o horário um dia antes.",
    ],
  },
  {
    id: "entregas",
    title: "Entregas",
    text: "Motoboys, ciclistas e entregadores para levar documentos, encomendas e compras na sua região.",
    tips: [
      "Informe origem, destino e o que será entregue.",
      "Combine o valor antes da corrida e acompanhe a entrega.",
      "Para itens de valor, peça confirmação de recebimento.",
    ],
  },
];

export const Route = createFileRoute("/servicos/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Serviços: pedreiro, encanador, diarista e mais | Beecos" },
      {
        name: "description",
        content:
          "Dicas para contratar pedreiro, eletricista, encanador, diarista e outros serviços com segurança, e como encontrar profissionais perto de você no Beecos.",
      },
      { property: "og:title", content: "Serviços: pedreiro, encanador, diarista e mais | Beecos" },
    ],
  }),
  component: Servicos,
});

function Servicos() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl">Serviços e como contratar bem</h1>
        <p className="text-muted-foreground">
          No Beecos você encontra profissionais perto de você e combina tudo direto pelo chat, sem
          intermediário. O Beecos conecta as pessoas: não emprega ninguém, não garante o serviço e
          não recebe o pagamento do serviço. Veja abaixo o que combinar antes de contratar.
        </p>
        <Button asChild>
          <Link to="/auth">Entrar ou criar conta</Link>
        </Button>
      </header>

      {GUIDES.map((g) => (
        <section key={g.id} id={g.id} className="block-card scroll-mt-20 space-y-3 p-4">
          <h2 className="text-xl">{g.title}</h2>
          <p>{g.text}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {g.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="block-card space-y-2 bg-accent p-4">
        <h2 className="text-xl">Segurança em primeiro lugar</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            Não pague adiantado a quem você não conhece. O Beecos nunca pede senha nem código.
          </li>
          <li>Combine preço, prazo e o que está incluso por escrito, pelo chat.</li>
          <li>Confira as avaliações de quem já usou e denuncie qualquer abuso.</li>
        </ul>
      </section>
    </div>
  );
}
