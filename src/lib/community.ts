import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostWithAuthor } from "@/components/PostCard";

export const MAX_GROUPS = 30;

export function communityErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("GRUPOS_DEMAIS"))
    return `Você já está em ${MAX_GROUPS} grupos. Saia de algum para entrar em outro.`;
  return null;
}

/** Ids das profissões cujos grupos a pessoa participa. */
export function useMyCommunities(userId: string | null) {
  const qc = useQueryClient();
  const key = ["my-communities", userId] as const;
  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select("profession_id, created_at")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r) => r.profession_id);
    },
  });
  async function join(professionId: string) {
    const { error } = await supabase
      .from("community_members")
      .insert({ user_id: userId!, profession_id: professionId });
    if (error && error.code !== "23505") throw error;
    qc.setQueryData<string[]>(key, (old) =>
      old?.includes(professionId) ? old : [...(old ?? []), professionId],
    );
    await qc.invalidateQueries({ queryKey: key });
  }
  async function leave(professionId: string) {
    const { error } = await supabase
      .from("community_members")
      .delete()
      .eq("user_id", userId!)
      .eq("profession_id", professionId);
    if (error) throw error;
    // some da lista na hora, sem esperar a rede
    qc.setQueryData<string[]>(key, (old) => (old ?? []).filter((id) => id !== professionId));
    await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ["community-overview"] });
  }
  return { ...query, ids: query.data ?? [], join, leave };
}

export type CommunityNumbers = { members: number; open_jobs: number };

/** Participantes e vagas abertas de cada grupo (números públicos). */
export function useCommunityOverview() {
  return useQuery({
    queryKey: ["community-overview"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("community_overview");
      if (error) throw error;
      const map = new Map<string, CommunityNumbers>();
      for (const r of data ?? [])
        map.set(r.profession_id, { members: r.members, open_jobs: r.open_jobs });
      return map;
    },
  });
}

/** Vagas de um ou mais grupos, das mais novas para as mais antigas. */
export function useCommunityFeed(professionIds: string[], signedIn: boolean) {
  const key = [...professionIds].sort().join(",");
  return useQuery({
    queryKey: ["community-feed", key, signedIn],
    enabled: professionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          signedIn
            ? "*, professions(name, slug), services(name), post_photos(id, path, sort), profiles!posts_user_id_fkey(full_name, slug, avatar_path, profile_skills(skill, level))"
            : "*, professions(name, slug), services(name), post_photos(id, path, sort)",
        )
        .eq("kind", "job")
        .in("profession_id", professionIds)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as PostWithAuthor[];
    },
  });
}

/** Quantas pessoas estão negociando cada vaga (só o número). */
export function useInterestCounts(ids: string[]) {
  const key = [...ids].sort().join(",");
  const { data } = useQuery({
    queryKey: ["interest-counts", key],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("post_interest_counts", { _post_ids: ids });
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.post_id, r.interested] as const));
    },
  });
  return data ?? new Map<string, number>();
}

/** "3 inscritos", "1 inscrito" ou "nenhum inscrito ainda". */
export function inscritosLabel(n: number): string {
  if (n <= 0) return "nenhum inscrito ainda";
  return n === 1 ? "1 inscrito" : `${n} inscritos`;
}

/** "Você está em 3 grupos · 12 vagas abertas". */
export function groupsSummary(groups: number, openJobs: number): string {
  const g = groups === 1 ? "1 grupo" : `${groups} grupos`;
  const v = openJobs === 1 ? "1 vaga aberta" : `${openJobs} vagas abertas`;
  return `Você está em ${g} · ${v}`;
}
