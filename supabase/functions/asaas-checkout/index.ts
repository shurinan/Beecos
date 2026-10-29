// Cria a cobrança no Asaas e devolve o link de pagamento (Pix, boleto ou cartão).
//  - kind "premium": assinatura mensal de R$ 14,90
//  - kind "urgent":  selo Urgente avulso de R$ 2,00 para uma vaga da própria pessoa
// Quem chama precisa estar logada. O CPF vai direto para o Asaas e não é guardado aqui.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PREMIUM_VALUE = 14.9;
const ANNUAL_VALUE = 149.0;
const URGENT_VALUE = 2.0;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function validCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}

function asaasBase(): string {
  return Deno.env.get("ASAAS_ENV") === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function asaas(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(asaasBase() + path, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Beecos",
      access_token: Deno.env.get("ASAAS_API_KEY") ?? "",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("asaas", path, res.status, JSON.stringify(data));
    throw new Error(data?.errors?.[0]?.description ?? `Asaas respondeu ${res.status}`);
  }
  return data;
}

// Depois de pagar, o Asaas devolve a pessoa para o Beecos. Só liga se ASAAS_SUCCESS_URL existir
// (o endereço do site, ex.: https://beecos.com.br): o Asaas só aceita o domínio cadastrado na conta.
function callback(tipo: "premium" | "anual" | "urgente") {
  const base = Deno.env.get("ASAAS_SUCCESS_URL");
  if (!base) return {};
  return { callback: { successUrl: `${base.replace(/\/$/, "")}/pagamento?tipo=${tipo}`, autoRedirect: true } };
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

type Method = "pix" | "boleto" | "card";
const BILLING: Record<Method, string> = { pix: "PIX", boleto: "BOLETO", card: "CREDIT_CARD" };

// Pix e boleto aparecem dentro do app (não têm dado sensível). O cartão vai para a página segura do Asaas:
// o número do cartão nunca passa pelo servidor do Beecos.
async function deliver(id: string, invoiceUrl: string, method: Method | undefined) {
  if (method === "pix") {
    const q = await asaas(`/payments/${id}/pixQrCode`);
    return { method, paymentId: id, pix: { image: q.encodedImage as string, code: q.payload as string, expires: q.expirationDate as string | null } };
  }
  if (method === "boleto") {
    const f = await asaas(`/payments/${id}/identificationField`);
    const p = await asaas(`/payments/${id}`);
    return { method, paymentId: id, boleto: { line: f.identificationField as string, url: (p.bankSlipUrl as string | null) ?? invoiceUrl } };
  }
  return { method: "card" as const, paymentId: id, url: invoiceUrl };
}

// já existe uma cobrança aberta: troca a forma de pagamento nela, se preciso
async function switchMethod(id: string, method: Method | undefined) {
  if (method) await asaas(`/payments/${id}`, { method: "PUT", body: { billingType: BILLING[method] } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método inválido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !Deno.env.get("ASAAS_API_KEY")) return json({ error: "pagamento não configurado" }, 500);
  const db = createClient(url, key, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Entre na sua conta para continuar." }, 401);

  let body: { kind?: string; cpf?: string; postId?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "pedido inválido" }, 400);
  }
  const kind = body.kind;
  const method: Method | undefined =
    body.method === "pix" || body.method === "boleto" || body.method === "card" ? body.method : undefined;
  if (kind !== "premium" && kind !== "annual" && kind !== "urgent") return json({ error: "pedido inválido" }, 400);

  try {
    if (kind === "urgent" && method === "boleto")
      return json({ error: "O boleto não está disponível para o selo Urgente. Use Pix ou cartão." }, 400);
    // 1) cliente no Asaas (reaproveita o que já existe)
    let { data: cust } = await db.from("asaas_customers").select("customer_id").eq("user_id", user.id).maybeSingle();
    if (!cust) {
      if (!body.cpf || !validCpf(body.cpf)) return json({ error: "CPF inválido. Confira os números." }, 400);
      const { data: prof } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const created = await asaas("/customers", {
        method: "POST",
        body: {
          name: prof?.full_name || user.email || "Cliente Beecos",
          email: user.email,
          cpfCnpj: body.cpf.replace(/\D/g, ""),
          externalReference: user.id,
          notificationDisabled: false,
        },
      });
      const ins = await db.from("asaas_customers").insert({ user_id: user.id, customer_id: created.id });
      if (ins.error) throw new Error("não foi possível guardar o cliente");
      cust = { customer_id: created.id };
    }
    const customer = cust.customer_id as string;

    if (kind === "premium") {
      const { data: sub } = await db
        .from("subscriptions")
        .select("plan, active_until, cancel_requested_at")
        .eq("user_id", user.id)
        .maybeSingle();
      const active = sub?.plan === "premium" && (!sub.active_until || new Date(sub.active_until) > new Date());
      if (active && !sub?.cancel_requested_at) return json({ error: "Você já é Premium." }, 409);

      // já existe uma cobrança aberta? devolve o mesmo link
      const { data: open } = await db
        .from("payments")
        .select("asaas_payment_id, invoice_url")
        .eq("user_id", user.id)
        .eq("kind", "premium")
        .eq("status", "pending")
        .not("invoice_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open?.invoice_url) {
        await switchMethod(open.asaas_payment_id as string, method);
        return json(await deliver(open.asaas_payment_id as string, open.invoice_url as string, method));
      }

      const s = await asaas("/subscriptions", {
        method: "POST",
        body: {
          customer,
          billingType: method ? BILLING[method] : "UNDEFINED",
          value: PREMIUM_VALUE,
          nextDueDate: method === "boleto" ? inDays(3) : today(),
          cycle: "MONTHLY",
          description: "Beecos Premium (mensal)",
          externalReference: `premium:${user.id}`,
          ...callback("premium"),
        },
      });
      const list = await asaas(`/subscriptions/${s.id}/payments`);
      const first = list?.data?.[0];
      if (!first?.invoiceUrl) throw new Error("O Asaas não devolveu o link de pagamento.");
      await db.rpc("asaas_apply_payment", {
        _payment_id: first.id,
        _customer: customer,
        _subscription: s.id,
        _ref: `premium:${user.id}`,
        _value: PREMIUM_VALUE,
        _status: "pending",
        _url: first.invoiceUrl,
      });
      return json(await deliver(first.id, first.invoiceUrl, method));
    }

    if (kind === "annual") {
      const { data: sub } = await db
        .from("subscriptions")
        .select("plan, active_until, cancel_requested_at, asaas_subscription_id, plan_term")
        .eq("user_id", user.id)
        .maybeSingle();
      const active = sub?.plan === "premium" && (!sub.active_until || new Date(sub.active_until) > new Date());
      if (active && !sub?.active_until) return json({ error: "Você já é Premium." }, 409);
      // assinatura mensal ativa seguiria cobrando: cancelar antes
      if (active && sub?.plan_term === "monthly" && sub.asaas_subscription_id && !sub.cancel_requested_at)
        return json({ error: "Cancele a assinatura mensal em Meu perfil antes de assinar o plano anual." }, 409);
      // anual com mais de 30 dias pela frente: ainda não precisa renovar
      if (active && sub?.plan_term === "annual" && new Date(sub.active_until!).getTime() - Date.now() > 30 * 86400_000)
        return json({ error: "Seu plano anual ainda tem mais de 30 dias. Renove perto do fim." }, 409);

      const { data: open } = await db
        .from("payments")
        .select("asaas_payment_id, invoice_url")
        .eq("user_id", user.id)
        .eq("kind", "annual")
        .eq("status", "pending")
        .not("invoice_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open?.invoice_url) {
        await switchMethod(open.asaas_payment_id as string, method);
        return json(await deliver(open.asaas_payment_id as string, open.invoice_url as string, method));
      }

      const due = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
      const p = await asaas("/payments", {
        method: "POST",
        body: {
          customer,
          billingType: method ? BILLING[method] : "UNDEFINED",
          value: ANNUAL_VALUE,
          dueDate: due,
          description: "Beecos Premium anual (12 meses)",
          externalReference: `annual:${user.id}`,
          ...callback("anual"),
        },
      });
      await db.rpc("asaas_apply_payment", {
        _payment_id: p.id,
        _customer: customer,
        _subscription: null,
        _ref: `annual:${user.id}`,
        _value: ANNUAL_VALUE,
        _status: "pending",
        _url: p.invoiceUrl,
      });
      return json(await deliver(p.id, p.invoiceUrl, method));
    }

    // urgent
    const postId = body.postId;
    if (!postId) return json({ error: "pedido inválido" }, 400);
    const { data: post } = await db
      .from("posts")
      .select("id, user_id, kind, urgent, title")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.user_id !== user.id || post.kind !== "job") return json({ error: "Vaga não encontrada." }, 404);
    if (post.urgent) return json({ error: "Esta vaga já tem o selo Urgente." }, 409);

    const { data: open } = await db
      .from("payments")
      .select("asaas_payment_id, invoice_url")
      .eq("user_id", user.id)
      .eq("kind", "urgent")
      .eq("post_id", postId)
      .eq("status", "pending")
      .not("invoice_url", "is", null)
      .limit(1)
      .maybeSingle();
    if (open?.invoice_url) {
        await switchMethod(open.asaas_payment_id as string, method);
        return json(await deliver(open.asaas_payment_id as string, open.invoice_url as string, method));
      }

    const due = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
    const p = await asaas("/payments", {
      method: "POST",
      body: {
        customer,
        billingType: method ? BILLING[method] : "UNDEFINED",
        value: URGENT_VALUE,
        dueDate: due,
        description: "Beecos: selo Urgente em uma vaga",
        externalReference: `urgent:${postId}`,
        ...callback("urgente"),
      },
    });
    await db.rpc("asaas_apply_payment", {
      _payment_id: p.id,
      _customer: customer,
      _subscription: null,
      _ref: `urgent:${postId}`,
      _value: URGENT_VALUE,
      _status: "pending",
      _url: p.invoiceUrl,
    });
    return json(await deliver(p.id, p.invoiceUrl, method));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Não foi possível criar a cobrança." }, 502);
  }
});
