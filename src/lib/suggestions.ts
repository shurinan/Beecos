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

export const SUGGESTION_TOPICS = [
  "Ideia nova",
  "Algo não funciona",
  "Está difícil de usar",
  "Elogio",
] as const;
export type SuggestionTopic = (typeof SUGGESTION_TOPICS)[number];

/** O texto que chega à equipe: o assunto na frente ("Algo não funciona: …"). */
export function suggestionBody(text: string, topic?: SuggestionTopic): string {
  const t = text.trim();
  return topic && topic !== "Ideia nova" ? `${topic}: ${t}` : t;
}

export async function sendSuggestion(userId: string, text: string, topic?: SuggestionTopic) {
  const { error } = await supabase
    .from("suggestions")
    .insert({ user_id: userId, body: suggestionBody(text, topic) });
  if (error) throw error;
}

/** Balão "Tem uma ideia?": na primeira visita e depois a cada 2 semanas, neste aparelho. */
const NUDGE_KEY = "beecos:ideia-balao";
const NUDGE_EVERY_MS = 14 * 86400_000;

export function shouldShowNudge(now = Date.now()): boolean {
  try {
    const last = Number(localStorage.getItem(NUDGE_KEY) ?? 0);
    return !last || now - last > NUDGE_EVERY_MS;
  } catch {
    return false;
  }
}

export function markNudgeShown(now = Date.now()) {
  try {
    localStorage.setItem(NUDGE_KEY, String(now));
  } catch {
    /* sem armazenamento: não mostra de novo nesta visita */
  }
}
