import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initials, timeAgo } from "@/lib/data";

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
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data?.length === 0 && (
        <p className="rounded-lg border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
          Nenhuma conversa ainda. Abra uma publicação e toque em "Conversar".
        </p>
      )}
      {data?.map((c) => {
        const other = c.user_a === userId ? c.b : c.a;
        return (
          <Link
            key={c.id}
            to="/mensagens/$id"
            params={{ id: c.id }}
            className="block-card flex items-center gap-3 p-3"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-bold border-2 border-foreground">
              {initials(other?.full_name ?? "")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{other?.full_name || "Usuário"}</p>
              <p className="truncate text-sm text-muted-foreground">{c.posts?.title ?? "Conversa direta"}</p>
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</span>
          </Link>
        );
      })}
    </div>
  );
}
