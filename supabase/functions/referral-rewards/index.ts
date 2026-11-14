// Indique e ganhe: quem já paga o Premium mensal ganha a próxima cobrança adiada em 30 dias.
// O banco já somou os 30 dias ao Premium (grant_referral_reward); aqui mudamos a data no Asaas.
// Chamada só pelo pg_cron a cada 10 minutos, com o segredo interno de app_keys.
import { createClient } from "jsr:@supabase/supabase-js@2";

async function asaas(path: string, method: string, body?: unknown) {
  const base =
    Deno.env.get("ASAAS_ENV") === "production"
      ? "https://api.asaas.com/v3"
      : "https://api-sandbox.asaas.com/v3";
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Beecos",
      access_token: Deno.env.get("ASAAS_API_KEY") ?? "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
}

/** "2026-12-10" + 30 dias, sem depender de fuso. */
export function plus30(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!) + 30 * 86400_000);
  return t.toISOString().slice(0, 10);
}

/** Só o próprio banco chama esta função: confere o segredo interno guardado em app_keys. */
async function fromDatabase(req: Request, db: ReturnType<typeof createClient>): Promise<boolean> {
  const sent = req.headers.get("x-internal-secret");
  if (!sent) return false;
  const { data } = await db.from("app_keys").select("value").eq("name", "internal_secret").maybeSingle();
  const expected = (data as { value?: string } | null)?.value;
  return !!expected && sent === expected;
}

Deno.serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response("configuração ausente", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  if (!(await fromDatabase(req, db))) return new Response("não autorizado", { status: 401 });

  const { data, error } = await db.rpc("claim_postpones", { _limit: 20 });
  if (error) return new Response(`erro ao ler a fila: ${error.message}`, { status: 500 });
  let done = 0;
  let failed = 0;
  for (const r of (data ?? []) as { id: string; asaas_subscription_id: string }[]) {
    const sub = await asaas(`/subscriptions/${r.asaas_subscription_id}`, "GET");
    const next =
      typeof sub.data["nextDueDate"] === "string" ? (sub.data["nextDueDate"] as string) : null;
    let err: string | null = null;
    if (!sub.ok || !next) err = `não achei a assinatura (${sub.status})`;
    else if (sub.data["status"] !== "ACTIVE") err = `assinatura ${String(sub.data["status"])}`;
    else {
      const upd = await asaas(`/subscriptions/${r.asaas_subscription_id}`, "POST", {
        nextDueDate: plus30(next),
        updatePendingPayments: true,
      });
      if (!upd.ok) err = `Asaas recusou (${upd.status}): ${JSON.stringify(upd.data).slice(0, 300)}`;
    }
    if (err) {
      failed++;
      await db.from("referral_rewards").update({ asaas_error: err }).eq("id", r.id);
    } else {
      done++;
      await db
        .from("referral_rewards")
        .update({ asaas_done_at: new Date().toISOString(), asaas_error: null })
        .eq("id", r.id);
    }
  }
  return Response.json({ done, failed });
});
