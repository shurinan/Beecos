import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/data";
import { Avatar } from "@/components/profile-bits";
import { profileParam } from "@/lib/urls";
import { useUnread } from "@/lib/chat-hooks";
import { NotificationCard } from "@/components/InstallPrompt";

export const Route = createFileRoute("/_authenticated/conversas/")({
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, last_message_at, user_a, user_b, posts!conversations_post_id_fkey(title), a:profiles!conversations_user_a_fkey(full_name, slug, avatar_path), b:profiles!conversations_user_b_fkey(full_name, slug, avatar_path), messages!inner(id)",
        )
        // só entra na lista a conversa que já tem mensagem; tocar em "Tenho interesse" e sair não cria item
        .limit(1, { referencedTable: "messages" })
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
      {isError && (
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Não foi possível carregar suas conversas.</p>
          <button type="button" className="text-sm font-bold underline" onClick={() => refetch()}>
            Tentar de novo
          </button>
        </div>
      )}
      {data?.length === 0 && (
        <p className="rounded-lg border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
          Nenhuma conversa ainda. Ela aparece aqui quando alguém escrever.
        </p>
      )}
      {data?.map((c) => {
        const other = c.user_a === userId ? c.b : c.a;
        const unread = byConversation[c.id] ?? 0;
        return (
          <Link
            key={c.id}
            to="/conversas/$slug"
            params={{
              slug: profileParam({
                id: c.user_a === userId ? c.user_b : c.user_a,
                slug: other?.slug,
              }),
            }}
            className={
              "block-card flex items-center gap-3 p-3 " + (unread > 0 ? "bg-primary/20" : "")
            }
          >
            <Avatar name={other?.full_name ?? ""} path={other?.avatar_path} size={44} />
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
