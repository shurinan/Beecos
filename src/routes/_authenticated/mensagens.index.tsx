import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initials, timeAgo } from "@/lib/data";
import { useUnread } from "@/lib/chat-hooks";
import { NotificationCard } from "@/components/InstallPrompt";

export const Route = createFileRoute("/_authenticated/mensagens/")({
  head: () => ({
    meta: [
      { title: "Conversas — Beecos" },
      { name: "description", content: "Suas negociações no Beecos." },
      { property: "og:title", content: "Conversas — Beecos" },
      { property: "og:description", content: "Suas negociações no Beecos." },
    ],
  }),
  component: Inbox,
});

function Inbox() {
  const { userId } = Route.useRouteContext();
  const { byConversation } = useUnread(userId);
  const { data, isLoading } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, last_message_at, user_a, user_b, posts(title), a:profiles!conversations_user_a_fkey(full_name), b:profiles!conversations_user_b_fkey(full_name)",
        )
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-2xl">Conversas</h1>
      <NotificationCard />
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data?.length === 0 && (
        <p className="rounded-lg border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
          Nenhuma conversa ainda. Abra uma publicação e toque em "Conversar".
        </p>
      )}
      {data?.map((c) => {
        const other = c.user_a === userId ? c.b : c.a;
        const unread = byConversation[c.id] ?? 0;
        return (
          <Link
            key={c.id}
            to="/mensagens/$id"
            params={{ id: c.id }}
            className={
              "block-card flex items-center gap-3 p-3 " + (unread > 0 ? "bg-primary/20" : "")
            }
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-primary font-bold">
              {initials(other?.full_name ?? "")}
            </span>
            <div className="min-w-0 flex-1">
              <p className={unread > 0 ? "font-extrabold" : "font-bold"}>
                {other?.full_name || "Usuário"}
              </p>
              <p
                className={
                  "truncate text-sm " +
                  (unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")
                }
              >
                {c.posts?.title ?? "Conversa direta"}
              </p>
            </div>
            <span className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</span>
              {unread > 0 && (
                <span
                  key={unread}
                  aria-label={`${unread} não lidas`}
                  className="badge-pop flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-foreground bg-destructive px-1.5 text-xs font-bold text-destructive-foreground"
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
