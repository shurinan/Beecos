import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getPlanUsage } from "@/lib/plans";

type Tipo = "premium" | "anual" | "urgente";

export const Route = createFileRoute("/_authenticated/pagamento")({
  validateSearch: (q: Record<string, unknown>): { tipo: Tipo } => ({
    tipo: q["tipo"] === "urgente" ? "urgente" : q["tipo"] === "anual" ? "anual" : "premium",
  }),
  head: () => ({ meta: [{ title: "Pagamento — Beecos" }, { name: "robots", content: "noindex" }] }),
  component: Pagamento,
});

const POLL_MS = 3000;
const GIVE_UP_MS = 120_000; // depois de 2 minutos para de conferir

function Pagamento() {
  const { userId } = Route.useRouteContext();
  const { tipo } = Route.useSearch();
  const urgent = tipo === "urgente";
  const qc = useQueryClient();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, []);

  // o aviso do Asaas chega em segundos (Pix) ou minutos: confere de tempos em tempos
  const { data: pay } = useQuery({
    queryKey: ["last-payment", userId, tipo],
    refetchInterval: (q) => (q.state.data?.status === "paid" || gaveUp ? false : POLL_MS),
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("status, value, paid_at, created_at")
        .eq("kind", urgent ? "urgent" : tipo === "anual" ? "annual" : "premium")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const { data: usage } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
    enabled: pay?.status === "paid",
  });
  const paid = pay?.status === "paid";
  useEffect(() => {
    if (paid) void qc.invalidateQueries();
  }, [paid, qc]);

  if (!paid) {
    return (
      <div className="mx-auto max-w-md space-y-5 pt-8 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground bg-accent">
          <Clock className="h-9 w-9" aria-hidden="true" />
        </span>
        <h1 className="text-3xl">
          {gaveUp ? "Ainda não vimos o pagamento" : "Confirmando o pagamento…"}
        </h1>
        <p role="status" className="text-sm text-muted-foreground">
          {gaveUp
            ? "Se você pagou por boleto, pode levar até 1 dia útil. Pix e cartão costumam confirmar em segundos. Avisamos quando chegar."
            : "Pix e cartão confirmam em segundos. Pode deixar esta tela aberta."}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link to="/perfil">Ver meu perfil</Link>
        </Button>
      </div>
    );
  }

  const until = usage?.activeUntil ? new Date(usage.activeUntil).toLocaleDateString("pt-BR") : null;
  return (
    <div className="mx-auto max-w-md space-y-5 pt-6 text-center">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground bg-primary text-primary-foreground shadow-[4px_4px_0_var(--foreground)]">
        <Check className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
      </span>
      <h1 className="text-3xl">Pagamento confirmado!</h1>
      <p className="text-muted-foreground">
        {urgent ? (
          "O selo Urgente já está na sua vaga."
        ) : (
          <>
            Você agora é <b className="text-foreground">Premium</b>. Já está valendo.
          </>
        )}
      </p>
      <dl className="block-card space-y-2 p-4 text-left text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{urgent ? "Item" : "Plano"}</dt>
          <dd className="font-bold">
            {urgent ? "Selo Urgente" : tipo === "anual" ? "Beecos Premium Anual" : "Beecos Premium"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-bold">
            {Number(pay.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </dd>
        </div>
        {!urgent && until && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Premium até</dt>
            <dd className="font-bold">{until}</dd>
          </div>
        )}
        {!urgent && (
          <p className="border-t border-foreground/15 pt-2 text-xs text-muted-foreground">
            Você pode desistir em até 7 dias e receber o valor de volta. É só cancelar em Meu
            perfil.
          </p>
        )}
      </dl>
      <div className="space-y-2">
        <Button asChild size="lg" className="h-14 w-full text-lg">
          <Link to="/publicar" search={{ tipo: "contratar" }}>
            Publicar uma vaga
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/perfil">Ver meu perfil</Link>
        </Button>
      </div>
    </div>
  );
}
