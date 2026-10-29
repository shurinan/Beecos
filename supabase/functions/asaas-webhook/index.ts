// Recebe os avisos do Asaas (pagamento confirmado, devolvido, vencido, assinatura cancelada).
// O Asaas manda o token combinado no cabeçalho "asaas-access-token"; sem ele, nada é aceito.
// Responde 200 para o que não interessa (para o Asaas não ficar reenviando) e 500 quando falhar de verdade
// (aí o Asaas tenta de novo).
import { createClient } from "jsr:@supabase/supabase-js@2";

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const STATUS: Record<string, string> = {
  PAYMENT_CONFIRMED: "paid",
  PAYMENT_RECEIVED: "paid",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_CHARGEBACK_REQUESTED: "refunded",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_DELETED: "canceled",
  PAYMENT_CREATED: "pending",
};

Deno.serve(async (req) => {
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  const got = req.headers.get("asaas-access-token") ?? "";
  if (!expected || !same(expected, got)) return new Response("não autorizado", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response("configuração ausente", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  let evt: { event?: string; payment?: Record<string, unknown>; subscription?: Record<string, unknown> };
  try {
    evt = await req.json();
  } catch {
    return new Response("json inválido", { status: 400 });
  }
  const name = evt.event ?? "";

  if (name === "SUBSCRIPTION_DELETED" || name === "SUBSCRIPTION_INACTIVATED") {
    const id = evt.subscription?.id as string | undefined;
    if (id) {
      const { error } = await db.rpc("asaas_mark_canceled", { _subscription: id });
      if (error) return new Response(error.message, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  const status = STATUS[name];
  const p = evt.payment;
  if (!status || !p?.id || !p.customer) return Response.json({ ignored: name });

  const { data, error } = await db.rpc("asaas_apply_payment", {
    _payment_id: p.id as string,
    _customer: p.customer as string,
    _subscription: (p.subscription as string | null) ?? null,
    _ref: (p.externalReference as string | null) ?? "",
    _value: Number(p.value ?? 0),
    _status: status,
    _url: (p.invoiceUrl as string | null) ?? null,
  });
  if (error) {
    console.error("apply", name, error.message);
    return new Response(error.message, { status: 500 });
  }
  return Response.json({ ok: true, result: data });
});
