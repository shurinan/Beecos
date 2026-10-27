import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Aviso de vaga nova, como o banco entrega. */
export type Alert = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  post_id: string | null;
  actor_id: string | null;
};

export type AlertPrefs = {
  in_app: boolean;
  email: boolean;
  push: boolean;
  paused_until: string | null;
};

export const DEFAULT_PREFS: AlertPrefs = {
  in_app: true,
  email: false,
  push: false,
  paused_until: null,
};

export const PAUSE_OPTIONS = [
  { days: 1, label: "1 dia" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
] as const;

export function pausedNow(prefs: AlertPrefs, now = new Date()): boolean {
  return !!prefs.paused_until && new Date(prefs.paused_until).getTime() > now.getTime();
}

export function pauseUntil(days: number, now = new Date()): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** "Pausados até 3/11" / "Ligados" / "Desligados". */
export function prefsSummary(prefs: AlertPrefs, now = new Date()): string {
  if (!prefs.in_app) return "Desligados";
  if (pausedNow(prefs, now)) {
    const d = new Date(prefs.paused_until!);
    return `Pausados até ${d.getDate()}/${d.getMonth() + 1}`;
  }
  return "Ligados";
}

const listKey = (userId: string | null) => ["alerts", userId] as const;
const prefsKey = (userId: string | null) => ["alert-prefs", userId] as const;

export function useAlerts(userId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: listKey(userId),
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<Alert[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, created_at, read_at, post_id, actor_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // chegou aviso novo: atualiza a lista (o banco só envia os da própria pessoa)
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`alerts-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: listKey(userId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const alerts = query.data ?? [];
  return { ...query, alerts, unread: alerts.filter((a) => !a.read_at).length };
}

export function useMarkAlertsRead(userId: string | null) {
  const qc = useQueryClient();
  return async (ids?: string[]) => {
    let q = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (ids) q = q.in("id", ids);
    const { error } = await q;
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: listKey(userId) });
  };
}

export function useAlertPrefs(userId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: prefsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<AlertPrefs> => {
      const { data, error } = await supabase
        .from("notification_prefs")
        .select("in_app, email, push, paused_until")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_PREFS;
    },
  });
  const prefs = query.data ?? DEFAULT_PREFS;
  async function save(patch: Partial<AlertPrefs>) {
    const { error } = await supabase
      .from("notification_prefs")
      .upsert({ user_id: userId!, ...prefs, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: prefsKey(userId) });
  }
  return { ...query, prefs, save };
}
