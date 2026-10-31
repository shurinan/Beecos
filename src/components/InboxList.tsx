import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Pin, Search, Star } from "lucide-react";
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
import { UserSeal } from "@/components/Seal";
import { profileParam } from "@/lib/urls";
import { useUnread } from "@/lib/chat-hooks";
import { NotificationCard } from "@/components/InstallPrompt";

type View = InboxView | "nao-lidas";

const VIEWS: [View, string][] = [
  ["todas", "Tudo"],
  ["nao-lidas", "Não lidas"],
  ["favoritas", "Favoritas"],
  ["arquivadas", "Arquivadas"],
];

function previewOf(
  m: { content: string; sender_id: string; attachment_name: string | null },
  me: string,
) {
  const text = m.content?.trim() || (m.attachment_name ? `Anexo: ${m.attachment_name}` : "Anexo");
  return (m.sender_id === me ? "Você: " : "") + text;
}

/** Lista de conversas no estilo do WhatsApp: foto, nome, hora, última mensagem e não lidas. */
export function InboxList({ userId }: { userId: string }) {
  const { byConversation } = useUnread(userId);
  const prefs = useConvPrefs(userId);
  const [view, setView] = useState<View>("todas");
  const [search, setSearch] = useState("");
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, last_message_at, user_a, user_b, posts!conversations_post_id_fkey(title), a:profiles!conversations_user_a_fkey(full_name, slug, avatar_path), b:profiles!conversations_user_b_fkey(full_name, slug, avatar_path), messages!inner(id, content, sender_id, created_at, attachment_name)",
        )
        // só entra na lista a conversa que já tem mensagem; tocar em "Tenho interesse" e sair não cria item
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" })
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const base = arrangeInbox(data ?? [], prefs, view === "nao-lidas" ? "todas" : view);
  const q = search.trim().toLowerCase();
  const shown = base.filter((c) => {
    if (view === "nao-lidas" && !(byConversation[c.id] ?? 0)) return false;
    if (!q) return true;
    const other = c.user_a === userId ? c.b : c.a;
    return (
      (other?.full_name ?? "").toLowerCase().includes(q) ||
      (c.posts?.title ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-3 p-4 pb-2">
        <h1 className="text-2xl">Conversas</h1>
        <NotificationCard />
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa"
            aria-label="Buscar conversa"
            className="h-10 w-full rounded-full border border-foreground/20 bg-muted pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro">
          {VIEWS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={
                "min-h-9 rounded-full border px-3.5 text-sm font-bold " +
                (view === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-foreground/25 bg-transparent text-foreground hover:bg-foreground/[0.07]")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="px-4 py-3 text-muted-foreground">Carregando…</p>}
      {isError && (
        <div className="space-y-3 p-5 text-center">
          <p className="font-semibold">Não foi possível carregar suas conversas.</p>
          <button type="button" className="text-sm font-bold underline" onClick={() => refetch()}>
            Tentar de novo
          </button>
        </div>
      )}
      {data && shown.length === 0 && (
        <p className="m-4 rounded-lg border-2 border-dashed border-foreground/30 p-6 text-center text-muted-foreground">
          {q
            ? "Nenhuma conversa com essa busca."
            : view === "nao-lidas"
              ? "Nenhuma mensagem não lida."
              : view === "favoritas"
                ? "Nenhuma conversa favorita. Use o menu ⋮ da conversa para favoritar."
                : view === "arquivadas"
                  ? "Nenhuma conversa arquivada."
                  : "Nenhuma conversa ainda. Ela aparece aqui quando alguém escrever."}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((c) => {
          const pref = prefs.get(c.id);
          const tag = TAGS.find((t) => t.key === pref?.tag);
          const other = c.user_a === userId ? c.b : c.a;
          const unread = byConversation[c.id] ?? 0;
          const slug = profileParam({
            id: c.user_a === userId ? c.user_b : c.user_a,
            slug: other?.slug,
          });
          const last = c.messages?.[0];
          const selected = path === `/conversas/${slug}`;
          return (
            <div key={c.id} className="relative border-b border-foreground/10">
              <Link
                to="/conversas/$slug"
                params={{ slug }}
                aria-current={selected ? "page" : undefined}
                className={
                  "flex items-center gap-3 px-4 py-3 pr-11 hover:bg-foreground/[0.05] " +
                  (selected ? "bg-foreground/[0.09]" : "")
                }
              >
                <Avatar
                  name={other?.full_name ?? ""}
                  path={other?.avatar_path}
                  size={52}
                  userId={c.user_a === userId ? c.user_b : c.user_a}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={
                        "flex min-w-0 items-center gap-1.5 text-base " +
                        (unread > 0 ? "font-extrabold" : "font-bold")
                      }
                    >
                      <span className="truncate">{other?.full_name || "Usuário"}</span>
                      <UserSeal userId={c.user_a === userId ? c.user_b : c.user_a} size={15} />
                      {pref?.pinned_at && (
                        <Pin className="h-3.5 w-3.5 shrink-0" aria-label="Fixada" />
                      )}
                      {pref?.favorite && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-current" aria-label="Favorita" />
                      )}
                      {reminderDue(pref?.remind_at ?? null) && (
                        <Bell
                          className="h-3.5 w-3.5 shrink-0 text-destructive"
                          aria-label="Lembrete"
                        />
                      )}
                    </p>
                    <span
                      className={
                        "shrink-0 text-xs " +
                        (unread > 0 ? "font-bold text-foreground" : "text-muted-foreground")
                      }
                    >
                      {timeAgo(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={
                        "min-w-0 truncate text-sm " +
                        (unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")
                      }
                    >
                      <span className="mr-1.5 rounded bg-primary/25 px-1.5 py-px text-[11px] font-bold">
                        {c.posts?.title ?? "Conversa direta"}
                      </span>
                      {last ? previewOf(last, userId) : ""}
                    </p>
                    {unread > 0 && (
                      <span
                        key={unread}
                        aria-label={`${unread} não lidas`}
                        className="badge-pop flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground"
                      >
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                  {tag && (
                    <p className="mt-0.5 text-xs">
                      <span className={"rounded px-1.5 py-0.5 font-bold text-[#1B1D23] " + tag.cls}>
                        {tag.label}
                      </span>
                    </p>
                  )}
                </div>
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
    </div>
  );
}
