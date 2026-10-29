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
  return "Não foi possível falar com o pagamento agora. Tente de novo em instantes.";
}

/** Cria a cobrança e devolve o link do Asaas (Pix, boleto ou cartão). */
export async function startCheckout(input: {
  kind: "premium" | "urgent";
  cpf?: string | undefined;
  postId?: string | undefined;
}): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.functions.invoke<Reply>("asaas-checkout", { body: input });
  if (error) return { error: await failure(error) };
  if (!data?.url) return { error: data?.error ?? "O pagamento não devolveu o link." };
  return { url: data.url };
}

/** Cancela o Premium. `refunded` é verdadeiro quando o valor foi devolvido (até 7 dias). */
export async function cancelSubscription(): Promise<{ refunded: boolean } | { error: string }> {
  const { data, error } = await supabase.functions.invoke<Reply>("asaas-cancel", { body: {} });
  if (error) return { error: await failure(error) };
  return { refunded: !!data?.refunded };
}

/** A pessoa já tem cadastro no Asaas (então não precisa informar o CPF de novo)? */
export async function hasBillingProfile(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
