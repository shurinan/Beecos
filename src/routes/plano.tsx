import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FREE_CHATS_PER_MONTH,
  FREE_JOBS_PER_MONTH,
  PREMIUM_PRICE,
  URGENT_PRICE,
} from "@/lib/plans";

export const Route = createFileRoute("/plano")({
  head: () => ({
    meta: [
      { title: "Plano Grátis e Premium — Beecos" },
      {
        name: "description",
        content: `Compare o plano Grátis e o Premium (${PREMIUM_PRICE}) do Beecos.`,
      },
    ],
  }),
  component: PlanPage,
});

type Cell = string | boolean;
const ROWS: { label: string; free: Cell; premium: Cell }[] = [
  { label: "Vagas publicadas", free: `${FREE_JOBS_PER_MONTH} por mês`, premium: "Sem limite" },
  { label: "Novas conversas", free: `${FREE_CHATS_PER_MONTH} por mês`, premium: "Sem limite" },
  { label: "Avisos de vagas perto de você", free: "Até 20 km", premium: "Até 50 km" },
  { label: "Pausar ou desligar os avisos", free: true, premium: true },
  { label: "Escolher de quais profissões receber avisos", free: false, premium: true },
  { label: "Aparece primeiro nas buscas", free: false, premium: true },
  { label: "Selo Premium no perfil e nas vagas", free: false, premium: true },
  { label: "Selo Urgente na vaga", free: `${URGENT_PRICE} por vaga`, premium: "Incluído" },
  { label: "Destaque na lista de vagas", free: false, premium: true },
  { label: "Fotos na vaga (até 5)", free: false, premium: true },
  { label: "Fila de espera e trocar quem negocia", free: false, premium: true },
  { label: "Sem anúncios", free: false, premium: true },
  { label: "Chat, avaliações e negociação", free: true, premium: true },
];

function Mark({ value }: { value: Cell }) {
  if (typeof value === "string") return <span className="font-semibold">{value}</span>;
  return value ? (
    <>
      <Check className="mx-auto h-5 w-5" aria-hidden="true" />
      <span className="sr-only">Incluído</span>
    </>
  ) : (
    <>
      <Minus className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Não incluído</span>
    </>
  );
}

function PlanPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl">Grátis ou Premium</h1>
        <p className="text-muted-foreground">
          Dá para usar o Beecos de graça. O Premium tira os limites e te põe na frente.
        </p>
      </header>

      <div className="block-card overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparativo entre os planos Grátis e Premium</caption>
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <th scope="col" className="p-3">
                Recurso
              </th>
              <th scope="col" className="w-24 p-3 text-center">
                Grátis
              </th>
              <th scope="col" className="w-28 bg-primary p-3 text-center text-primary-foreground">
                <Crown className="mr-1 inline h-4 w-4" aria-hidden="true" />
                Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b border-border last:border-0">
                <th scope="row" className="p-3 text-left font-semibold">
                  {r.label}
                </th>
                <td className="p-3 text-center">
                  <Mark value={r.free} />
                </td>
                <td className="bg-accent p-3 text-center">
                  <Mark value={r.premium} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="block-card space-y-2 p-5">
        <p className="font-display text-xl">Premium — {PREMIUM_PRICE}</p>
        <p className="text-sm text-muted-foreground">
          O pagamento será feito pelo Asaas (Pix, boleto ou cartão). Ainda não está aberto. Você
          pode desistir em até 7 dias depois de pagar e receber o valor de volta, e cancelar quando
          quiser em Meu perfil: o Premium vai até o fim do período pago e não é cobrado de novo.
        </p>
        <Button className="w-full" onClick={() => toast("O pagamento abre em breve!")}>
          Quero ser Premium
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Os limites do plano Grátis zeram todo mês. Quem publicou antes continua publicado.
        </p>
      </section>

      <p className="text-center text-sm">
        <Link
          to="/vagas"
          search={{ q: undefined, tipo: undefined }}
          className="font-bold underline"
        >
          Ver as vagas
        </Link>
      </p>
    </div>
  );
}
