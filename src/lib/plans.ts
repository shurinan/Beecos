import { supabase } from "@/integrations/supabase/client";

export const FREE_JOBS_PER_MONTH = 2;
export const FREE_CHATS_PER_MONTH = 5;
/** Valor do Premium mensal. Mudou aqui, muda em todas as telas (o servidor cobra o valor dele). */
export const PREMIUM_MONTHLY = "R$ 14,90";
export const PREMIUM_PRICE = `${PREMIUM_MONTHLY}/mês`;
/** Plano anual: pagamento único, vale 12 meses (equivale a 10 meses do mensal). */
export const ANNUAL_PRICE = "R$ 149";
export const ANNUAL_PER_MONTH = "R$ 12,42";
/** 1 − 149 ÷ (12 × 14,90) = 16,7%. */
export const ANNUAL_SAVING = "17%";
/** Selo Urgente para quem não é Premium (pagamento avulso). */
export const URGENT_PRICE = "R$ 2";

export function limitMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("LIMITE_VAGAS"))
    return `Você já publicou ${FREE_JOBS_PER_MONTH} vagas este mês. Seja Premium para publicar sem limite.`;
  if (msg.includes("LIMITE_CHATS"))
    return `Você já iniciou ${FREE_CHATS_PER_MONTH} conversas este mês. Seja Premium para conversar sem limite.`;
  if (msg.includes("FILA_ESPERA"))
    return "Você está na fila de espera. Avisamos quando chegar a sua vez.";
  if (msg.includes("VAGA_PREENCHIDA")) return "Essa vaga foi preenchida.";
  if (msg.includes("NEGOCIACOES_CHEIAS")) return "Essa vaga foi preenchida.";
  if (msg.includes("NEGOCIACAO_ENCERRADA"))
    return "Quem publicou esta vaga encerrou a negociação com você.";
  if (msg.includes("CONTA_EM_ANALISE"))
    return "Há uma denúncia em análise envolvendo uma das contas. Por até 2 horas não é possível negociar, publicar vagas nem receber propostas.";
  return null;
}

export async function getPlanUsage(userId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();
  const [sub, jobs, chats] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, active_until, cancel_requested_at, plan_term, first_paid_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "job")
      .gte("created_at", since),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_a", userId)
      .gte("created_at", since),
  ]);
  const s = sub.data;
  const premium =
    !!s && s.plan === "premium" && (!s.active_until || new Date(s.active_until) > new Date());
  return {
    premium,
    activeUntil: s?.active_until ?? null,
    cancelRequestedAt: s?.cancel_requested_at ?? null,
    annual: s?.plan_term === "annual",
    firstPaidAt: s?.first_paid_at ?? null,
    jobs: jobs.count ?? 0,
    chats: chats.count ?? 0,
  };
}
