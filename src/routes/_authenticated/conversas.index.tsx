import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Pin, Star, StickyNote } from "lucide-react";
import { ConversationMenu } from "@/components/ConversationMenu";
import {
  arrangeInbox,
  reminderDue,
  TAGS,
  useConvPrefs,
  type InboxView,
} from "@/lib/conversation-prefs";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/data";
import { Avatar } from "@/components/profile-bits";
import { profileParam } from "@/lib/urls";
import { useUnread } from "@/lib/chat-hooks";
import { NotificationCard } from "@/components/InstallPrompt";

export const Route = createFileRoute("/_authenticated/conversas/")({
  staticData: { sitemap: false },
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
  const prefs = useConvPrefs(userId);
  const [view, setView] = useState<InboxView>("todas");
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

  const shown = arrangeInbox(data ?? [], prefs, view);

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
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border-2 border-foreground">
        {(
          [
            ["todas", "Todas"],
            ["favoritas", "Favoritas"],
            ["arquivadas", "Arquivadas"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={
              "min-h-10 py-2 text-sm font-bold " +
              (view === v ? "bg-foreground text-background" : "bg-background text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {data && shown.length === 0 && (
        <p className="rounded-lg border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
          {view === "favoritas"
            ? "Nenhuma conversa favorita. Use o menu ⋮ da conversa para favoritar."
            : view === "arquivadas"
              ? "Nenhuma conversa arquivada."
              : "Nenhuma conversa ainda. Ela aparece aqui quando alguém escrever."}
        </p>
      )}
      {shown.map((c) => {
        const pref = prefs.get(c.id);
        const tag = TAGS.find((t) => t.key === pref?.tag);
        const other = c.user_a === userId ? c.b : c.a;
        const unread = byConversation[c.id] ?? 0;
        return (
          <div key={c.id} className="relative">
            <Link
              to="/conversas/$slug"
              params={{
                slug: profileParam({
                  id: c.user_a === userId ? c.user_b : c.user_a,
                  slug: other?.slug,
                }),
              }}
              className={
                "block-card flex items-center gap-3 p-3 pr-12 " +
                (unread > 0 ? "bg-primary/20" : "")
              }
            >
              <Avatar name={other?.full_name ?? ""} path={other?.avatar_path} size={44} />
              <div className="min-w-0 flex-1">
                <p
                  className={
                    "flex items-center gap-1.5 " + (unread > 0 ? "font-extrabold" : "font-bold")
                  }
                >
                  <span className="truncate">{other?.full_name || "Usuário"}</span>
                  {pref?.pinned_at && <Pin className="h-3.5 w-3.5 shrink-0" aria-label="Fixada" />}
                  {pref?.favorite && (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-current" aria-label="Favorita" />
                  )}
                  {reminderDue(pref?.remind_at ?? null) && (
                    <Bell className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Lembrete" />
                  )}
                </p>
                <p
                  className={
                    "truncate text-sm " +
                    (unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")
                  }
                >
                  {c.posts?.title ?? "Conversa direta"}
                </p>
                {(tag || pref?.note) && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                    {tag && (
                      <span className={"rounded px-1.5 py-0.5 font-bold text-[#1B1D23] " + tag.cls}>
                        {tag.label}
                      </span>
                    )}
                    {pref?.note && (
                      <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                        <StickyNote className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{pref.note}</span>
                      </span>
                    )}
                  </p>
                )}
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
            <ConversationMenu
              conversationId={c.id}
              userId={userId}
              className="absolute right-1 top-1"
            />
          </div>
        );
      })}
    </div>
  );
}
