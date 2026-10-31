import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostWithAuthor } from "@/components/PostCard";
import type { FeedOrder } from "@/lib/community";
import { supabase } from "@/integrations/supabase/client";

export const MAX_CHANNELS = 3;
export const MAX_CHANNEL_PROFESSIONS = 8;

/** Prazos fixos da vaga. O banco aceita no máximo 30 dias. */
export const DEADLINES = [
  { days: 1, label: "24 horas" },
  { days: 3, label: "3 dias" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
] as const;
export type Deadline = (typeof DEADLINES)[number]["days"];

export function deadlineLabel(days: number): string {
  return DEADLINES.find((d) => d.days === days)?.label ?? `${days} dias`;
}

export function expiresAt(days: Deadline, from: Date = new Date()): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

/** "Termina em 23 h", "Termina em 6 dias" ou "Encerrada". */
export function timeLeftLabel(
  expires: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!expires) return null;
  const ms = new Date(expires).getTime() - now.getTime();
  if (ms <= 0) return "Encerrada";
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return `Termina em ${hours} h`;
  const days = Math.ceil(hours / 24);
  return `Termina em ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function channelErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("CANAL_SO_PREMIUM")) return "Criar canal é um recurso Premium.";
  if (msg.includes("LIMITE_CANAIS")) return `Você já tem ${MAX_CHANNELS} canais.`;
  if (msg.includes("LIMITE_OFICIOS_CANAL"))
    return `Escolha no máximo ${MAX_CHANNEL_PROFESSIONS} profissões.`;
  if (msg.includes("CANAL_INVALIDO")) return "Esse canal não está disponível para publicar.";
  return null;
}

export type Channel = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  default_days: number;
  hidden_at: string | null;
  created_at: string;
  channel_professions: { profession_id: string }[];
};

export type ChannelNumbers = { followers: number; open_jobs: number; following: boolean };

const SELECT =
  "id, owner_id, name, slug, description, default_days, hidden_at, created_at, channel_professions(profession_id)";

/** Todos os canais visíveis, com os números de cada um. A busca e o filtro por ofício são feitos na tela. */
export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select(SELECT)
        .is("hidden_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const channels = (data ?? []) as unknown as Channel[];
      const numbers = new Map<string, ChannelNumbers>();
      for (let i = 0; i < channels.length; i += 100) {
        const ids = channels.slice(i, i + 100).map((c) => c.id);
        const { data: nums, error: e2 } = await supabase.rpc("channel_overview", { _ids: ids });
        if (e2) throw e2;
        for (const n of nums ?? [])
          numbers.set(n.channel_id, {
            followers: n.followers,
            open_jobs: n.open_jobs,
            following: n.following,
          });
      }
      return { channels, numbers };
    },
  });
}

export function useChannel(slug: string) {
  return useQuery({
    queryKey: ["channel", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select(SELECT)
        .eq("slug", slug)
        .limit(1);
      if (error) throw error;
      const channel = ((data ?? [])[0] as unknown as Channel | undefined) ?? null;
      if (!channel) return null;
      const { data: nums, error: e2 } = await supabase.rpc("channel_overview", {
        _ids: [channel.id],
      });
      if (e2) throw e2;
      const n = nums?.[0];
      return {
        channel,
        numbers: {
          followers: n?.followers ?? 0,
          open_jobs: n?.open_jobs ?? 0,
          following: n?.following ?? false,
        },
      };
    },
  });
}

/** Canais criados pela própria pessoa (para publicar vagas neles). */
export function useMyChannels(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-channels", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, slug, default_days")
        .eq("owner_id", userId!)
        .is("hidden_at", null)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFollow(userId: string | null | undefined) {
  const qc = useQueryClient();
  async function follow(channelId: string) {
    const { error } = await supabase
      .from("channel_follows")
      .insert({ channel_id: channelId, user_id: userId! });
    if (error && error.code !== "23505") throw error;
    await refresh();
  }
  async function unfollow(channelId: string) {
    const { error } = await supabase
      .from("channel_follows")
      .delete()
      .eq("channel_id", channelId)
      .eq("user_id", userId!);
    if (error) throw error;
    await refresh();
  }
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["channels"] }),
      qc.invalidateQueries({ queryKey: ["channel"] }),
    ]);
  }
  return { follow, unfollow };
}

/** Vagas de um canal. O banco já esconde as encerradas de quem não é o dono. */
export function useChannelFeed(channelId: string | undefined, order: FeedOrder) {
  return useQuery({
    queryKey: ["channel-feed", channelId, order],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "*, professions(name, slug), services(name), post_photos(id, path, sort), profiles!posts_user_id_fkey(full_name, slug, avatar_path, profile_skills(skill, level))",
        )
        .eq("channel_id", channelId!)
        .eq("kind", "job")
        .order(order === "maior" || order === "menor" ? "price_value" : "created_at", {
          ascending: order === "antigo" || order === "menor",
          nullsFirst: false,
        })
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as PostWithAuthor[];
    },
  });
}
