// Cancela a assinatura Premium da pessoa logada. O Premium segue até o fim do período pago e não renova.
// Se a primeira cobrança foi paga há 7 dias ou menos (direito de arrependimento), o valor é devolvido
// e o Premium termina na hora.
import { createClient } from "jsr:@supabase/supabase-js@2";

const REFUND_DAYS = 7;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function asaas(path: string, method: string, body?: unknown) {
  const base =
    Deno.env.get("ASAAS_ENV") === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", "User-Agent": "Beecos", access_token: Deno.env.get("ASAAS_API_KEY") ?? "" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método inválido" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "configuração ausente" }, 500);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Entre na sua conta para continuar." }, 401);

  const { data: sub } = await db
    .from("subscriptions")
    .select("plan, asaas_subscription_id, first_paid_at, cancel_requested_at, plan_term")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub || sub.plan !== "premium") return json({ error: "Você não tem assinatura." }, 404);

  // plano anual: não há assinatura a encerrar; só a desistência em até 7 dias devolve o valor
  if (sub.plan_term === "annual") {
    const { data: pay } = await db
      .from("payments")
      .select("asaas_payment_id, paid_at")
      .eq("user_id", user.id)
      .eq("kind", "annual")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pay?.paid_at || Date.now() - new Date(pay.paid_at).getTime() > REFUND_DAYS * 86400_000)
      return json({ error: "O plano anual não renova sozinho, então não há o que cancelar. A devolução vale só até 7 dias depois do pagamento." }, 409);
    const r = await asaas(`/payments/${pay.asaas_payment_id}/refund`, "POST", { description: "Desistência em até 7 dias" });
    if (!r.ok) {
      console.error("asaas refund", r.status, JSON.stringify(r.data));
      return json({ error: "Não foi possível devolver agora. Fale com contato@beecos.com.br." }, 502);
    }
    await db.from("subscriptions").update({ active_until: new Date().toISOString() }).eq("user_id", user.id);
    return json({ ok: true, refunded: true });
  }

  // assinatura cobrada pelo Asaas: encerra por lá para não cobrar de novo
  if (sub.asaas_subscription_id) {
    const del = await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE");
    if (!del.ok && del.status !== 404) {
      console.error("asaas cancel", del.status, JSON.stringify(del.data));
      return json({ error: "Não foi possível cancelar agora. Tente de novo em instantes." }, 502);
    }
  }
  await db.from("subscriptions").update({ cancel_requested_at: sub.cancel_requested_at ?? new Date().toISOString() }).eq("user_id", user.id);

  // arrependimento: primeira cobrança paga há até 7 dias → devolve
  let refunded = false;
  const within =
    sub.first_paid_at && Date.now() - new Date(sub.first_paid_at).getTime() <= REFUND_DAYS * 86400_000;
  if (within && sub.asaas_subscription_id) {
    const { data: pay } = await db
      .from("payments")
      .select("asaas_payment_id")
      .eq("user_id", user.id)
      .eq("kind", "premium")
      .eq("asaas_subscription_id", sub.asaas_subscription_id)
      .eq("status", "paid")
      .order("paid_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pay) {
      const r = await asaas(`/payments/${pay.asaas_payment_id}/refund`, "POST", {
        description: "Desistência em até 7 dias",
      });
      if (r.ok) {
        refunded = true;
        await db.from("subscriptions").update({ active_until: new Date().toISOString() }).eq("user_id", user.id);
      } else {
        console.error("asaas refund", r.status, JSON.stringify(r.data));
        return json({ error: "A assinatura foi cancelada, mas a devolução falhou. Fale com contato@beecos.com.br." }, 502);
      }
    }
  }
  return json({ ok: true, refunded });
});
