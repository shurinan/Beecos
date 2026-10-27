import { supabase } from "@/integrations/supabase/client";

export const SUGGESTION_MIN = 5;
export const SUGGESTION_MAX = 1000;

export function suggestionErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("SUGESTOES_DEMAIS")) return "Você já enviou 5 ideias hoje. Volte amanhã!";
  return null;
}

export function suggestionValid(text: string): boolean {
  const n = text.trim().length;
  return n >= SUGGESTION_MIN && n <= SUGGESTION_MAX;
}

export async function sendSuggestion(userId: string, text: string) {
  const { error } = await supabase.from("suggestions").insert({ user_id: userId, body: text.trim() });
  if (error) throw error;
}
