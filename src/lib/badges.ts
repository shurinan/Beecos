import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Tier = "verified" | "premium" | "both";

/** Só sim/não de cada item: os dados em si nunca saem do banco. */
export type BadgeInfo = {
  premium: boolean;
  doc: boolean;
  email: boolean;
  phone: boolean;
};

/** Verificado = documento aprovado. Premium = plano ativo. Os dois = selo dourado. */
export function tierOf(info: BadgeInfo | null | undefined): Tier | null {
  if (!info) return null;
  if (info.doc && info.premium) return "both";
  if (info.doc) return "verified";
  if (info.premium) return "premium";
  return null;
}

export const TIER_TITLE: Record<Tier, string> = {
  verified: "Verificado",
  premium: "Premium",
  both: "Verificado e Premium",
};

/** Como na OLX: só o que é necessário para a conversa. Endereço e outros dados não são conferidos. */
export const CHECKS: { key: "email" | "phone" | "doc"; label: string }[] = [
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "doc", label: "Identidade" },
];

type Waiter = { resolve: (v: BadgeInfo | null) => void; reject: (e: unknown) => void };
let queue = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const current = queue;
  queue = new Map();
  timer = null;
  const ids = [...current.keys()];
  try {
    const { data, error } = await supabase.rpc("badge_info", { _user_ids: ids });
    if (error) throw error;
    const byId = new Map((data ?? []).map((r) => [r.user_id, r] as const));
    for (const [id, waiters] of current) {
      const r = byId.get(id);
      const info: BadgeInfo | null = r
        ? { premium: r.premium, doc: r.doc, email: r.email, phone: r.phone }
        : null;
      waiters.forEach((w) => w.resolve(info));
    }
  } catch (e) {
    for (const waiters of current.values()) waiters.forEach((w) => w.reject(e));
  }
}

/** Junta os pedidos feitos no mesmo instante numa chamada só (uma lista de 30 conversas = 1 consulta). */
function fetchBadge(id: string): Promise<BadgeInfo | null> {
  return new Promise((resolve, reject) => {
    const list = queue.get(id) ?? [];
    list.push({ resolve, reject });
    queue.set(id, list);
    // o banco aceita até 100 por vez
    if (queue.size >= 100) {
      void flush();
      return;
    }
    timer ??= setTimeout(() => void flush(), 15);
  });
}

export function useBadge(userId: string | null | undefined) {
  const q = useQuery({
    queryKey: ["badge", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => fetchBadge(userId!),
  });
  return { info: q.data ?? null, tier: tierOf(q.data) };
}
