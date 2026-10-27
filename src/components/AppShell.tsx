import { Link } from "@tanstack/react-router";
import { Bell, Home, MessageCircle, UserRound, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useChatBackground, usePresenceHeartbeat, useUnread } from "@/lib/chat-hooks";
import { useAlerts } from "@/lib/alerts";
import { InstallPrompt } from "@/components/InstallPrompt";

/** Liga, para quem está logado, o contador de não lidas, os avisos e o "visto por último". */
function ChatBackground({ userId }: { userId: string }) {
  useChatBackground(userId);
  usePresenceHeartbeat(userId);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { total: unread } = useUnread(userId);
  const { unread: alertsUnread } = useAlerts(userId);
  const item =
    "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold text-muted-foreground";
  const active = { className: "text-foreground" };
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-foreground bg-primary">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="font-display text-2xl text-foreground">
            Beecos
            <span className="text-background [-webkit-text-stroke:1px_var(--foreground)]">.</span>
          </Link>
          {userId && (
            <Link
              to="/avisos"
              aria-label={alertsUnread > 0 ? `Avisos, ${alertsUnread} não lidos` : "Avisos"}
              className="relative rounded-md p-2 text-foreground"
            >
              <Bell className="h-6 w-6" />
              {alertsUnread > 0 && (
                <span
                  key={alertsUnread}
                  className="badge-pop absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full border border-foreground bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
                >
                  {alertsUnread > 99 ? "99+" : alertsUnread}
                </span>
              )}
            </Link>
          )}
          {!userId && (
            <Link
              to="/auth"
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-bold text-background"
            >
              Entrar
            </Link>
          )}
        </div>
        <div className="hazard-stripe h-1.5" />
      </header>
      {userId && <ChatBackground userId={userId} />}
      <main className="flex-1 px-4 pb-28 pt-4">
        <InstallPrompt />
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-foreground bg-background">
        <div className="mx-auto flex max-w-2xl">
          <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
            <Home className="h-5 w-5" /> Início
          </Link>
          {userId ? (
            <>
              <Link to="/mensagens" className={item} activeProps={active}>
                <span className="relative">
                  <MessageCircle className="h-5 w-5" />
                  {unread > 0 && (
                    <span
                      key={unread}
                      aria-label={`${unread} mensagens não lidas`}
                      className="badge-pop absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full border border-foreground bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                Conversas
              </Link>
              <Link to="/painel" className={item} activeProps={active}>
                <UserRound className="h-5 w-5" /> Meu perfil
              </Link>
            </>
          ) : (
            <Link to="/auth" className={item} activeProps={active}>
              <LogIn className="h-5 w-5" /> Entrar
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
