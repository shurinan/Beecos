import { supabase } from "@/integrations/supabase/client";

export const FREE_JOBS_PER_MONTH = 2;
export const FREE_CHATS_PER_MONTH = 5;
export const PREMIUM_PRICE = "R$ 14,90/mês";

export function limitMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("LIMITE_VAGAS"))
    return `Você já publicou ${FREE_JOBS_PER_MONTH} vagas este mês. Seja Premium para publicar sem limite.`;
  if (msg.includes("LIMITE_CHATS"))
    return `Você já iniciou ${FREE_CHATS_PER_MONTH} conversas este mês. Seja Premium para conversar sem limite.`;
  return null;
}

export async function getPlanUsage(userId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();
  const [sub, jobs, chats] = await Promise.all([
    supabase.from("subscriptions").select("plan, active_until").eq("user_id", userId).maybeSingle(),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "job").gte("created_at", since),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_a", userId).gte("created_at", since),
  ]);
  const s = sub.data;
  const premium = !!s && s.plan === "premium" && (!s.active_until || new Date(s.active_until) > new Date());
  return { premium, jobs: jobs.count ?? 0, chats: chats.count ?? 0 };
}
