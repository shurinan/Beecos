import { Link } from "@tanstack/react-router";
import { Home, MessageCircle, UserRound, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const item =
    "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold text-muted-foreground";
  const active = { className: "text-foreground" };
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-foreground bg-primary">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-2xl text-foreground">
            Beecos<span className="text-background [-webkit-text-stroke:1px_var(--foreground)]">.</span>
          </Link>
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
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-foreground bg-background">
        <div className="mx-auto flex max-w-2xl">
          <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
            <Home className="h-5 w-5" /> Início
          </Link>
          {userId ? (
            <>
              <Link to="/mensagens" className={item} activeProps={active}>
                <MessageCircle className="h-5 w-5" /> Conversas
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
