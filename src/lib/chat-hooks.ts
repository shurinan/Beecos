import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tabTitle } from "@/lib/chat";

const unreadKey = (userId: string | null) => ["unread", userId] as const;

/** Mensagens não lidas por conversa e no total. */
export function useUnread(userId: string | null) {
  const { data } = useQuery({
    queryKey: unreadKey(userId),
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unread_counts");
      if (error) throw error;
      const byConversation: Record<string, number> = {};
      let total = 0;
      for (const r of data ?? []) {
        byConversation[r.conversation_id] = Number(r.unread);
        total += Number(r.unread);
      }
      return { byConversation, total };
    },
  });
  return { byConversation: data?.byConversation ?? {}, total: data?.total ?? 0 };
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function showSystemNotification(title: string, body: string, url: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    // No celular só funciona pelo service worker; no computador o caminho direto também serve.
    const reg =
      "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: url,
        data: { url },
      });
    } else {
      const n = new Notification(title, { body, icon: "/icon-192.png", tag: url });
      n.onclick = () => {
        window.focus();
        window.location.assign(url);
        n.close();
      };
    }
  } catch {
    /* sem aviso do sistema: o contador e o aviso na tela continuam */
  }
}

/** Tira da bandeja os avisos de uma conversa: a pessoa já viu as mensagens. */
export async function clearConversationNotifications(conversationId: string) {
  toast.dismiss(`/mensagens/${conversationId}`);
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const list = (await reg?.getNotifications({ tag: `/mensagens/${conversationId}` })) ?? [];
    for (const n of list) n.close();
  } catch {
    /* sem service worker: o aviso some sozinho ou ao ser tocado */
  }
}

/**
 * Fica ligado enquanto a pessoa está logada: escuta mensagens novas (o banco só envia as das
 * conversas dela), atualiza o contador, a aba do navegador e avisa quando ela não está olhando.
 */
export function useChatBackground(userId: string | null) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const { total } = useUnread(userId);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`inbox-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as {
            conversation_id: string;
            sender_id: string;
            content: string;
            attachment_name: string | null;
          };
          qc.invalidateQueries({ queryKey: ["conversations", userId] });
          if (m.sender_id === userId) return;
          const url = `/mensagens/${m.conversation_id}`;
          const looking = !document.hidden && pathRef.current === url;
          if (looking) return; // a conversa aberta marca como lida sozinha
          qc.invalidateQueries({ queryKey: unreadKey(userId) });
          const sender = await qc
            .fetchQuery({
              queryKey: ["profile-name", m.sender_id],
              staleTime: 5 * 60_000,
              queryFn: async () => {
                const { data } = await supabase
                  .from("profiles")
                  .select("full_name")
                  .eq("id", m.sender_id)
                  .maybeSingle();
                return data?.full_name || "Alguém";
              },
            })
            .catch(() => "Alguém");
          const preview =
            m.content || (m.attachment_name ? `📎 ${m.attachment_name}` : "Nova mensagem");
          if (document.hidden) {
            void showSystemNotification(`Nova mensagem de ${sender}`, preview.slice(0, 120), url);
          } else {
            toast(`Nova mensagem de ${sender}`, {
              id: url,
              description: preview.slice(0, 80),
              action: {
                label: "Abrir",
                onClick: () =>
                  router.navigate({ to: "/mensagens/$id", params: { id: m.conversation_id } }),
              },
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc, router]);

  // "(3) Beecos" na aba, mantido mesmo quando a página troca o título
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
      const next = tabTitle(base, total);
      if (document.title !== next) document.title = next;
    };
    apply();
    const t = setTimeout(apply, 50);
    return () => clearTimeout(t);
  }, [total, pathname]);
}

/** Atualiza o "visto por último" enquanto a pessoa está com o app aberto. */
export function usePresenceHeartbeat(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    const beat = () => {
      if (!document.hidden) void supabase.rpc("touch_presence");
    };
    beat();
    const timer = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [userId]);
}

const TYPING_TTL_MS = 4000;
const TYPING_THROTTLE_MS = 2500;

/**
 * Presença e "digitando…" numa conversa, pelo canal em tempo real (nada disso vai para o banco).
 * Com `share` desligado a pessoa não aparece online nem avisa que está digitando.
 */
export function useChatChannel(
  conversationId: string,
  userId: string,
  otherId: string | null,
  share: boolean,
) {
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!otherId) return;
    const ch = supabase.channel(`chat:${conversationId}`, {
      config: { presence: { key: userId } },
    });
    chRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      setOtherOnline(Object.keys(ch.presenceState()).includes(otherId));
    }).on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { user?: string; typing?: boolean };
      if (p.user !== otherId) return;
      clearTimeout(clearTimer.current);
      setOtherTyping(!!p.typing);
      if (p.typing) clearTimer.current = setTimeout(() => setOtherTyping(false), TYPING_TTL_MS);
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && share) void ch.track({ at: Date.now() });
    });
    return () => {
      clearTimeout(clearTimer.current);
      chRef.current = null;
      setOtherOnline(false);
      setOtherTyping(false);
      supabase.removeChannel(ch);
    };
  }, [conversationId, userId, otherId, share]);

  /** Chame a cada tecla; envia no máximo uma vez a cada 2,5 s. `false` avisa que parou. */
  function notifyTyping(typing: boolean) {
    const ch = chRef.current;
    if (!ch || !share) return;
    const now = Date.now();
    if (typing && now - lastSent.current < TYPING_THROTTLE_MS) return;
    lastSent.current = typing ? now : 0;
    void ch.send({ type: "broadcast", event: "typing", payload: { user: userId, typing } });
  }

  return { otherOnline, otherTyping, notifyTyping };
}
