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

async function findConversation(me: string, other: string, postId: string | null) {
  let q = supabase
    .from("conversations")
    .select("id")
    .or(`and(user_a.eq.${me},user_b.eq.${other}),and(user_a.eq.${other},user_b.eq.${me})`)
    .order("created_at")
    .limit(1);
  q = postId ? q.eq("post_id", postId) : q.is("post_id", null);
  const { data, error } = await q;
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

/** Finds an existing conversation between two people (about a post) or creates one. */
export async function openConversation(me: string, other: string, postId: string | null) {
  // `other` comes from the URL and is interpolated into a PostgREST filter, so it
  // must be a plain uuid before it gets anywhere near the query string.
  if (!isUuid(me) || !isUuid(other) || (postId !== null && !isUuid(postId))) {
    throw new Error("Identificador inválido");
  }
  const existing = await findConversation(me, other, postId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a: me, user_b: other, post_id: postId })
    .select("id")
    .single();
  if (error) {
    // Lost a race with another tab/request: the unique index rejected the
    // duplicate, so the conversation exists now — reuse it.
    if ((error as { code?: string }).code === "23505") {
      const raced = await findConversation(me, other, postId);
      if (raced) return raced;
    }
    throw error; // may be LIMITE_CHATS from the free-plan limit
  }
  return data.id;
}
