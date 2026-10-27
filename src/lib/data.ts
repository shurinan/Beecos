import { supabase } from "@/integrations/supabase/client";

export type PostKind = "job" | "available";

export const KIND_LABEL: Record<PostKind, string> = {
  job: "Vaga",
  available: "Disponível",
};

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Abre a conversa com alguém. Cada par de pessoas tem uma só conversa: se já existe, devolve a
 * mesma (e passa o assunto para a publicação atual); se não, cria.
 */
export async function openConversation(me: string, other: string, postId: string | null) {
  // Os ids vêm da URL: só uuid de verdade segue adiante.
  if (!isUuid(me) || !isUuid(other) || (postId !== null && !isUuid(postId))) {
    throw new Error("Identificador inválido");
  }
  const { data, error } = await supabase.rpc("open_conversation", {
    _other: other,
    ...(postId ? { _post: postId } : {}),
  });
  if (error) throw error; // pode ser LIMITE_CHATS, do plano grátis
  return data;
}
