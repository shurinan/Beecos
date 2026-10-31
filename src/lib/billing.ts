import { supabase } from "@/integrations/supabase/client";

type Reply = { url?: string; error?: string; ok?: boolean; refunded?: boolean };

/** Lê a mensagem de erro que as funções do servidor devolvem (o corpo vem dentro do erro). */
async function failure(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await ctx.json()) as Reply;
      if (body.error) return body.error;
    } catch {
      // cai na mensagem genérica
    }
  }
  return "O sistema de pagamento não respondeu. Tente de novo em instantes.";
}

export type PayMethod = "pix" | "boleto" | "card";

export type Charge =
  | { method: "card"; paymentId: string; url: string }
  | {
      method: "pix";
      paymentId: string;
      pix: { image: string; code: string; expires: string | null };
    }
  | { method: "boleto"; paymentId: string; boleto: { line: string; url: string } };

type CheckoutReply = Partial<Charge> & { error?: string };

/**
 * Cria a cobrança no Asaas. Pix e boleto voltam para mostrar na própria tela; o cartão volta com o
 * link da página segura do Asaas (o número do cartão nunca passa pelo Beecos).
 */
export async function startCheckout(input: {
  kind: "premium" | "annual" | "urgent";
  method: PayMethod;
  cpf?: string | undefined;
  postId?: string | undefined;
}): Promise<Charge | { error: string }> {
  const { data, error } = await supabase.functions.invoke<CheckoutReply>("asaas-checkout", {
    body: input,
  });
  if (error) return { error: await failure(error) };
  if (!data?.paymentId || !data.method)
    return { error: data?.error ?? "Não foi possível gerar a cobrança. Tente de novo." };
  return data as Charge;
}

/** Fica olhando se o Asaas já confirmou este pagamento (o webhook grava no banco). */
export async function isPaid(paymentId: string): Promise<boolean> {
  const { data } = await supabase
    .from("payments")
    .select("status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  return data?.status === "paid";
}

/** Cancela o Premium. `refunded` é verdadeiro quando o valor foi devolvido (até 7 dias). */
export async function cancelSubscription(): Promise<{ refunded: boolean } | { error: string }> {
  const { data, error } = await supabase.functions.invoke<Reply>("asaas-cancel", { body: {} });
  if (error) return { error: await failure(error) };
  return { refunded: !!data?.refunded };
}

/**
 * Assinatura mensal que o Asaas ainda vai cobrar: precisa ser cancelada antes de excluir a conta,
 * senão a cobrança continua sem conta no Beecos. O plano anual não renova, então não entra aqui.
 */
export async function hasRenewingSubscription(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, plan_term, asaas_subscription_id, cancel_requested_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (
    !!data &&
    data.plan === "premium" &&
    data.plan_term !== "annual" &&
    !!data.asaas_subscription_id &&
    !data.cancel_requested_at
  );
}

/** A pessoa já tem cadastro no Asaas (então não precisa informar o CPF de novo)? */
export async function hasBillingProfile(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
