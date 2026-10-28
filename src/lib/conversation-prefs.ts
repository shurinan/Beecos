import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MAX_PINS = 3;
export const MAX_NOTE = 500;

export const TAGS = [
  { key: "orcamento", label: "Orçamento", cls: "bg-[#F9C80E]" },
  { key: "combinado", label: "Combinado", cls: "bg-[#7FC8A9]" },
  { key: "aguardando", label: "Aguardando", cls: "bg-[#F2A48B]" },
  { key: "concluido", label: "Concluído", cls: "bg-[#8FB8F0]" },
] as const;
export type TagKey = (typeof TAGS)[number]["key"];

export type ConvPref = {
  conversation_id: string;
  favorite: boolean;
  pinned_at: string | null;
  archived: boolean;
  tag: string | null;
  note: string | null;
  remind_at: string | null;
  cleared_at: string | null;
};

export const NO_PREF: Omit<ConvPref, "conversation_id"> = {
  favorite: false,
  pinned_at: null,
  archived: false,
  tag: null,
  note: null,
  remind_at: null,
  cleared_at: null,
};

export type PrefPatch = Partial<Omit<ConvPref, "conversation_id">>;

const COLS = "conversation_id, favorite, pinned_at, archived, tag, note, remind_at, cleared_at";

/** As preferências de todas as minhas conversas, por id da conversa. */
export function useConvPrefs(userId: string | null) {
  const { data } = useQuery({
    queryKey: ["conv-prefs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("conversation_prefs").select(COLS);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.conversation_id, r as ConvPref] as const));
    },
  });
  return data ?? new Map<string, ConvPref>();
}

export const pinLimitMessage = `Você já fixou ${MAX_PINS} conversas. Solte uma para fixar outra.`;

/** Grava uma mudança (na tela na hora; se o banco recusar, volta). */
export function useSetPref(userId: string | null) {
  const qc = useQueryClient();
  const key = ["conv-prefs", userId];
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PrefPatch }) => {
      const { error } = await supabase
        .from("conversation_prefs")
        .upsert(
          { conversation_id: id, user_id: userId!, ...patch },
          { onConflict: "conversation_id,user_id" },
        );
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<Map<string, ConvPref>>(key);
      const next = new Map(before ?? []);
      next.set(id, { ...NO_PREF, ...next.get(id), conversation_id: id, ...patch });
      qc.setQueryData(key, next);
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function isPinLimitError(e: { message?: string } | null | undefined): boolean {
  return !!e?.message?.includes("LIMITE_FIXADAS");
}

export function pinnedCount(prefs: Map<string, ConvPref>): number {
  let n = 0;
  for (const p of prefs.values()) if (p.pinned_at && !p.cleared_at) n++;
  return n;
}

export type InboxRow = { id: string; last_message_at: string };
export type InboxView = "todas" | "favoritas" | "arquivadas";

/** Filtra e ordena a lista: excluídas somem (até chegar mensagem nova), fixadas primeiro. */
export function arrangeInbox<T extends InboxRow>(
  rows: T[],
  prefs: Map<string, ConvPref>,
  view: InboxView,
): T[] {
  const get = (id: string) => prefs.get(id) ?? { ...NO_PREF, conversation_id: id };
  return rows
    .filter((r) => {
      const p = get(r.id);
      if (p.cleared_at && r.last_message_at <= p.cleared_at) return false;
      if (view === "arquivadas") return p.archived;
      if (p.archived) return false;
      return view === "favoritas" ? p.favorite : true;
    })
    .sort((a, b) => {
      const pa = get(a.id).pinned_at;
      const pb = get(b.id).pinned_at;
      if (pa && pb) return pa < pb ? -1 : 1;
      if (pa) return -1;
      if (pb) return 1;
      return a.last_message_at < b.last_message_at ? 1 : -1;
    });
}

/** O lembrete já venceu? */
export function reminderDue(remindAt: string | null, now = Date.now()): boolean {
  return !!remindAt && new Date(remindAt).getTime() <= now;
}
