import { supabase } from "@/integrations/supabase/client";

export const REPORT_REASONS = [
  { value: "golpe", label: "Golpe ou pedido de dinheiro adiantado" },
  { value: "ofensivo", label: "Conteúdo ofensivo ou assédio" },
  { value: "falso", label: "Informação falsa ou enganosa" },
  { value: "contato_externo", label: "Tenta levar a conversa para fora do app" },
  { value: "outro", label: "Outro motivo" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export type ReportTarget = "post" | "profile";

/** Frase simples para o erro do banco; null se não for um erro de denúncia. */
export function reportErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("DENUNCIA_REPETIDA")) return "Você já denunciou isso. Um moderador vai avaliar.";
  if (msg.includes("DENUNCIA_PROPRIA")) return "Você não pode denunciar o seu próprio conteúdo.";
  if (msg.includes("DENUNCIAS_DEMAIS")) return "Você já enviou muitas denúncias hoje. Tente amanhã.";
  if (msg.includes("DENUNCIA_INVALIDA")) return "Não foi possível denunciar. Esse conteúdo pode ter sido removido.";
  return null;
}

export async function sendReport(
  type: ReportTarget,
  target: string,
  reason: ReportReason,
  details: string,
) {
  const { error } = await supabase.rpc("report_content", {
    _type: type,
    _target: target,
    _reason: reason,
    _details: details.trim(),
  });
  if (error) throw error;
}

export async function resolveReport(
  id: string,
  action: "dismiss" | "hide_post" | "restore_post" | "done",
  note: string,
) {
  const { error } = await supabase.rpc("resolve_report", { _id: id, _action: action, _note: note });
  if (error) throw error;
}
