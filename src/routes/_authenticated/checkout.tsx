import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Crown, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { hasBillingProfile, startCheckout, type Charge, type PayMethod } from "@/lib/billing";
import { PayPanel } from "@/components/PayPanel";
import { formatCpf, isValidCpf } from "@/lib/cpf";
import { ANNUAL_PER_MONTH, ANNUAL_SAVING, getPlanUsage, PREMIUM_PRICE } from "@/lib/plans";

type Tipo = "premium" | "anual" | "urgente";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (q: Record<string, unknown>): { tipo: Tipo; vaga?: string | undefined } => ({
    tipo: q["tipo"] === "urgente" ? "urgente" : q["tipo"] === "anual" ? "anual" : "premium",
    vaga: typeof q["vaga"] === "string" ? q["vaga"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Seu pedido — Beecos" }, { name: "robots", content: "noindex" }],
  }),
  component: Checkout,
});

const PREMIUM_BENEFITS = [
  "Vagas e conversas sem limite",
  "Aparece primeiro nas buscas, com selo Premium",
  "Avisos de vagas até 50 km de você",
  "Fotos na vaga, destaque e selo Urgente incluídos",
  "Fila de espera e troca de quem negocia",
];

function monthsAhead(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString("pt-BR");
}

function Checkout() {
  const { userId } = Route.useRouteContext();
  const { tipo, vaga } = Route.useSearch();
  const navigate = useNavigate();
  const urgent = tipo === "urgente";
  const annual = tipo === "anual";
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<PayMethod>("pix");
  const [charge, setCharge] = useState<Charge | null>(null);

  const { data: usage } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
  });
  const { data: known } = useQuery({
    queryKey: ["billing-known", userId],
    queryFn: () => hasBillingProfile(userId),
  });
  const { data: post, isLoading: loadingPost } = useQuery({
    queryKey: ["checkout-post", vaga],
    enabled: urgent && !!vaga,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, title, city, price, urgent, kind, user_id")
        .eq("id", vaga!)
        .maybeSingle();
      return data;
    },
  });

  const price = urgent ? "R$ 2,00" : annual ? "R$ 149,00" : "R$ 14,90";
  const alreadyPremium =
    !urgent &&
    !!usage?.premium &&
    (annual ? !usage.activeUntil : !usage.cancelRequestedAt || usage.annual);
  const postProblem = urgent
    ? !vaga
      ? "Escolha a vaga que vai receber o selo."
      : loadingPost
        ? null
        : !post || post.user_id !== userId || post.kind !== "job"
          ? "Não encontramos essa vaga entre as suas."
          : post.urgent
            ? "Esta vaga já tem o selo Urgente."
            : null
    : null;
  const needCpf = known === false;

  async function pay() {
    if (needCpf && !isValidCpf(cpf)) return void toast.error("CPF inválido. Confira os números.");
    if (!accepted) return void toast.error("Aceite os Termos de uso para continuar.");
    setBusy(true);
    const r = await startCheckout({
      kind: urgent ? "urgent" : annual ? "annual" : "premium",
      method,
      postId: urgent ? vaga : undefined,
      cpf: needCpf ? cpf : undefined,
    });
    setBusy(false);
    if ("error" in r) return void toast.error(r.error);
    // cartão: a página segura do Asaas recebe os dados; Pix e boleto aparecem aqui mesmo
    if (r.method === "card") return void window.location.assign(r.url);
    setCharge(r);
  }

  const goPaid = useCallback(
    () => void navigate({ to: "/pagamento", search: { tipo }, replace: true }),
    [navigate, tipo],
  );

  return (
    <form
      className="mx-auto max-w-md space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void pay();
      }}
    >
      <button
        type="button"
        onClick={() => void navigate({ to: urgent ? "/perfil" : "/plano" })}
        className="flex min-h-11 items-center gap-1 font-bold"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </button>

      <header className="space-y-1">
        <h1 className="text-3xl">{urgent ? "Selo Urgente" : "Seu pedido"}</h1>
        <p className="text-sm text-muted-foreground">
          {urgent
            ? "Mostre que esta vaga precisa de alguém logo."
            : "Confira e siga para o pagamento. Leva menos de 1 minuto."}
        </p>
      </header>

      {!urgent && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Escolha o plano">
          {(
            [
              { t: "premium", name: "Mensal", price: "R$ 14,90", per: "por mês" },
              { t: "anual", name: "Anual", price: "R$ 149", per: `≈ ${ANNUAL_PER_MONTH} por mês` },
            ] as const
          ).map((o) => {
            const on = tipo === o.t;
            return (
              <button
                key={o.t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() =>
                  void navigate({ to: "/checkout", search: { tipo: o.t }, replace: true })
                }
                className={
                  "relative flex flex-col items-start gap-0.5 rounded-lg border-2 border-foreground p-3 text-left transition-[background-color,box-shadow] " +
                  (on ? "bg-foreground text-background" : "bg-card hover:bg-foreground/[0.07]")
                }
              >
                {o.t === "anual" && (
                  <span className="absolute -top-2.5 right-2 rounded-md border-2 border-foreground bg-primary px-1.5 text-[11px] font-bold uppercase text-primary-foreground">
                    Economize {ANNUAL_SAVING}
                  </span>
                )}
                <span className="font-bold">{o.name}</span>
                <span className="font-display text-xl leading-tight">{o.price}</span>
                <span className={"text-xs " + (on ? "opacity-80" : "text-muted-foreground")}>
                  {o.per}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {urgent && post && !postProblem && (
        <div className="block-card space-y-1 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Esta vaga receberá o selo
          </p>
          <p className="font-display text-lg leading-tight">{post.title}</p>
          <p className="text-sm text-muted-foreground">
            {post.city}
            {post.price ? ` · ${post.price}` : ""}
          </p>
        </div>
      )}

      <section className="block-card space-y-3 p-4" aria-label="Resumo do pedido">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border-2 border-foreground bg-primary text-primary-foreground"
          >
            <Crown className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight">
              {urgent ? "Selo Urgente" : annual ? "Beecos Premium Anual" : "Beecos Premium"}
            </p>
            <p className="text-sm text-muted-foreground">
              {urgent
                ? "Pagamento único, só nesta vaga"
                : annual
                  ? "Pagamento único · vale 12 meses"
                  : "Assinatura mensal"}
            </p>
          </div>
          <p className="text-right font-display text-xl leading-tight">
            {price}
            {!urgent && (
              <span className="block text-xs font-normal text-muted-foreground">por mês</span>
            )}
          </p>
        </div>
        <hr className="border-foreground/15" />
        {urgent ? (
          <div className="space-y-1.5 text-sm">
            <p>Selo vermelho na vaga, que chama atenção na lista.</p>
            <p>Sem assinatura. Não renova e não cobra de novo.</p>
            <p className="rounded-md bg-accent p-2">
              Com o <b>Premium</b> o Urgente já vem incluído.{" "}
              <Link to="/plano" className="font-bold underline">
                Ver Premium
              </Link>
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-2 text-sm">
              {PREMIUM_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" strokeWidth={3} />
                  {b}
                </li>
              ))}
            </ul>
            <p className="flex justify-between gap-2 rounded-md bg-accent p-2.5 text-sm">
              <span>Hoje você paga</span>
              <b>{price}</b>
            </p>
            {annual ? (
              <p className="-mt-1 text-xs text-muted-foreground">
                Vale até {monthsAhead(12)}. Não renova sozinho: nada é cobrado de novo. Você paga 10
                meses e leva 12 (economia de {ANNUAL_SAVING}).
              </p>
            ) : (
              <p className="-mt-1 text-xs text-muted-foreground">
                Próxima cobrança em {monthsAhead(1)}. Cancele quando quiser. ({PREMIUM_PRICE})
              </p>
            )}
          </>
        )}
      </section>

      {(alreadyPremium || postProblem) && (
        <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-bold">
          {alreadyPremium
            ? annual
              ? "Você já é Premium sem data para acabar."
              : "Você já é Premium."
            : postProblem}
        </p>
      )}

      {charge && charge.method !== "card" ? (
        <PayPanel charge={charge} price={price} onPaid={goPaid} onBack={() => setCharge(null)} />
      ) : (
        <>
          {needCpf && (
            <div className="space-y-1.5">
              <Label htmlFor="cpf">Seu CPF</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={cpf}
                maxLength={14}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                className="h-12 border-2 border-foreground text-lg"
              />
              <p className="text-xs text-muted-foreground">
                O Asaas, que cuida do pagamento, pede o CPF. O Beecos não guarda.
              </p>
            </div>
          )}
          {known && (
            <p className="text-xs text-muted-foreground">Seu CPF já está cadastrado no Asaas.</p>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-bold">Como pagar</legend>
            <div className="grid gap-2" role="radiogroup" aria-label="Forma de pagamento">
              {(
                [
                  {
                    m: "pix",
                    name: "Pix",
                    hint: urgent ? "O selo entra na hora" : "Libera na hora",
                  },
                  {
                    m: "card",
                    name: "Cartão de crédito",
                    hint: "Você digita no ambiente seguro do Asaas",
                  },
                  ...(urgent
                    ? []
                    : [{ m: "boleto", name: "Boleto", hint: "Confirma em até 1 dia útil" }]),
                ] as { m: PayMethod; name: string; hint: string }[]
              ).map((o) => {
                const on = method === o.m;
                return (
                  <button
                    key={o.m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMethod(o.m)}
                    className={
                      "flex min-h-14 items-center gap-3 rounded-lg border-2 border-foreground p-3 text-left transition-[background-color] " +
                      (on ? "bg-foreground text-background" : "bg-card hover:bg-foreground/[0.07]")
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={
                        "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 " +
                        (on ? "border-background" : "border-foreground")
                      }
                    >
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-background" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{o.name}</span>
                      <span
                        className={"block text-xs " + (on ? "opacity-80" : "text-muted-foreground")}
                      >
                        {o.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {method === "card" && (
              <p className="flex items-start gap-2 rounded-md bg-accent p-2.5 text-xs">
                <Lock className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                <span>
                  Ao continuar você vai para a página segura do Asaas (endereço com cadeado), onde
                  digita os dados do cartão. O Beecos nunca vê nem guarda o número do seu cartão.
                </span>
              </p>
            )}
          </fieldset>

          {!urgent && (
            <p className="flex items-start gap-2.5 rounded-lg border-2 border-dashed border-foreground bg-card p-3 text-sm">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
              <span>
                <b>7 dias para desistir.</b>{" "}
                {annual
                  ? "Desista em Meu perfil e o valor volta para você."
                  : "Cancele em Meu perfil e o valor volta para você."}
              </span>
            </p>
          )}

          <div className="flex items-start gap-2.5 text-sm">
            <Checkbox
              id="aceite"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5 h-5 w-5"
            />
            <Label htmlFor="aceite" className="font-normal leading-snug">
              Li e aceito os{" "}
              <Link to="/termos" className="font-bold underline" target="_blank">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" className="font-bold underline" target="_blank">
                Privacidade
              </Link>
              .
            </Label>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              type="submit"
              size="lg"
              className="h-14 w-full text-lg"
              loading={busy}
              disabled={alreadyPremium || !!postProblem || known === undefined}
            >
              {method === "pix"
                ? "Gerar Pix"
                : method === "boleto"
                  ? "Gerar boleto"
                  : "Pagar com cartão"}{" "}
              · {price}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Conexão criptografada · pagamento
              pelo Asaas
            </p>
          </div>
        </>
      )}
    </form>
  );
}
