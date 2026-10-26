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

/** Finds an existing conversation between two people (about a post) or creates one. */
export async function openConversation(me: string, other: string, postId: string | null) {
  let q = supabase
    .from("conversations")
    .select("id")
    .or(`and(user_a.eq.${me},user_b.eq.${other}),and(user_a.eq.${other},user_b.eq.${me})`)
    .limit(1);
  q = postId ? q.eq("post_id", postId) : q.is("post_id", null);
  const { data: existing } = await q;
  if (existing && existing[0]) return existing[0].id;
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a: me, user_b: other, post_id: postId })
    .select("id")
    .single();
  if (error) throw error; // may be LIMITE_CHATS from the free-plan limit
  return data.id;
}
