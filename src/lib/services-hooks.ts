import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PostSlots = { vacancies: number; taken: number };

/** Vagas ocupadas por publicação (dado público, só números). */
export function usePostStats(ids: string[] | undefined) {
  const list = ids ?? [];
  const { data } = useQuery({
    queryKey: ["post-stats", [...list].sort().join(",")],
    enabled: list.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_stats")
        .select("post_id, vacancies, taken")
        .in("post_id", list);
      if (error) throw error;
      const map: Record<string, PostSlots> = {};
      for (const r of data ?? []) {
        if (r.post_id) map[r.post_id] = { vacancies: r.vacancies ?? 1, taken: r.taken ?? 0 };
      }
      return map;
    },
  });
  return data ?? {};
}
