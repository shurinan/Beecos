import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { takeDestination } from "@/lib/after-login";
import { Bell, Briefcase, Home, MessageCircle, UserRound, LogIn, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useChatBackground, usePresenceHeartbeat, useUnread } from "@/lib/chat-hooks";
import { useAlerts } from "@/lib/alerts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SuggestionButton } from "@/components/SuggestionButton";
import { BackButton } from "@/components/BackButton";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal";
import { HoldBanner } from "@/components/HoldBanner";
import { AssistedHelp } from "@/components/AssistedHelp";
import { InstallPrompt } from "@/components/InstallPrompt";

/** Liga, para quem está logado, o contador de não lidas, os avisos e o "visto por último". */
function ChatBackground({ userId }: { userId: string }) {
  useChatBackground(userId);
  usePresenceHeartbeat(userId);
  return null;
}

/** Quem entrou com o Google volta para a tela inicial: daqui seguimos para a tela que a pessoa tinha tocado. */
function AfterLogin({ userId }: { userId: string }) {
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (path === "/auth") return; // a tela de entrar cuida disso
    const dest = takeDestination();
    if (dest) router.history.replace(dest);
  }, [userId, path, router]);
  return null;
}

const DESKTOP_LINKS = [
  { to: "/", label: "Início", props: { to: "/" } },
  {
    to: "/vagas",
    label: "Vagas",
    props: { to: "/vagas", search: { q: undefined, tipo: undefined } },
  },
  {
    to: "/comunidade",
    label: "Comunidade",
    props: { to: "/comunidade", search: { grupo: undefined } },
  },
  { to: "/conversas", label: "Conversas", props: { to: "/conversas" } },
  { to: "/perfil", label: "Meu perfil", props: { to: "/perfil" } },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { total: unread } = useUnread(userId);
  const { unread: alertsUnread } = useAlerts(userId);
  const bub =
    "flex h-10 w-10 items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-150 group-hover:bg-foreground/[0.07] group-hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] group-active:scale-95 group-data-[status=active]:bg-foreground/15! group-data-[status=active]:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)]!";
  const item =
    "group flex flex-1 flex-col items-center gap-0.5 py-1 text-xs font-semibold text-muted-foreground";
  const active = { className: "text-foreground" };
  const path = useRouterState({ select: (st) => st.location.pathname });
  // início e lista de vagas usam a largura toda no computador; o resto fica numa coluna
  const wide =
    path === "/" ||
    path === "/perfil" ||
    path === "/vagas" ||
    path === "/vagas/" ||
    path.startsWith("/conversas");
  // no celular, a conversa aberta ocupa a tela toda (sem menu inferior), como no WhatsApp
  const inChat = /^\/conversas\/[^/]+/.test(path);
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-foreground px-3 py-2 font-bold text-background focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-20 border-b-2 border-foreground bg-primary">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4 lg:max-w-[1120px]">
          <div className="flex items-center">
            <BackButton />
            <Link
              to="/"
              className="flex items-center gap-2 font-display text-2xl text-primary-foreground"
            >
              <img src="/logo.svg" alt="" width={28} height={28} className="size-7" />
              <span>
                Beecos
                <span className="text-[oklch(0.99_0.004_95)] [-webkit-text-stroke:1px_var(--primary-foreground)]">
                  .
                </span>
              </span>
            </Link>
          </div>
          {userId && (
            <nav aria-label="Principal" className="mr-auto ml-6 hidden items-center gap-1 lg:flex">
              {DESKTOP_LINKS.map((l) => (
                <Link
                  key={l.to}
                  {...l.props}
                  className="relative rounded-lg px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-foreground/10"
                  activeProps={{ className: "bg-foreground! text-primary! dark:text-background!" }}
                  activeOptions={{ exact: l.to === "/" }}
                >
                  {l.label}
                  {l.to === "/conversas" && unread > 0 && (
                    <span
                      aria-label={`${unread} mensagens não lidas`}
                      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-foreground bg-destructive px-1 text-[10px] leading-none text-destructive-foreground"
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {userId && <SuggestionButton />}
            {userId && (
              <Link
                to="/avisos"
                aria-label={alertsUnread > 0 ? `Avisos, ${alertsUnread} não lidos` : "Avisos"}
                className="relative rounded-md p-2 text-primary-foreground"
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
                className="rounded-md bg-primary-foreground px-3 py-1.5 text-sm font-bold text-primary"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
        <div className="hazard-stripe h-1.5" />
      </header>
      <AssistedHelp />
      {userId && <ChatBackground userId={userId} />}
      {userId && <AfterLogin userId={userId} />}
      <main
        id="conteudo"
        tabIndex={-1}
        className={`mx-auto w-full max-w-2xl flex-1 px-4 outline-none lg:pb-12 lg:pt-8 ${inChat ? "pb-0 pt-0" : "pb-28 pt-4"} ${wide ? "lg:max-w-[1120px]" : ""}`}
      >
        <div className={inChat ? "max-lg:hidden" : ""}>
          <HoldBanner />
          <InstallPrompt />
        </div>
        {children}
        <p
          className={`mt-8 text-center text-xs text-muted-foreground ${inChat ? "max-lg:hidden" : ""}`}
        >
          {userId && (
            <>
              <Link to="/plano" className="underline">
                Planos
              </Link>{" "}
              ·{" "}
            </>
          )}
          <Link to="/servicos" className="underline">
            Serviços
          </Link>{" "}
          ·{" "}
          <Link to="/ajuda" className="underline">
            Ajuda
          </Link>{" "}
          ·{" "}
          <Link to="/termos" className="underline">
            Termos
          </Link>{" "}
          ·{" "}
          <Link to="/privacidade" className="underline">
            Privacidade
          </Link>
          <span className="mx-auto mt-2 block max-w-md">
            O Beecos conecta pessoas. Não emprega ninguém, não garante clientes nem serviços e não
            recebe o pagamento do serviço: vocês combinam tudo direto.
          </span>
          <span className="mt-1 block">
            Contato: <span className="selectable">{PRIVACY_CONTACT_EMAIL}</span>
          </span>
        </p>
      </main>
      {userId ? (
        <nav
          className={`fixed inset-x-0 bottom-0 z-20 border-t-2 border-foreground bg-background lg:hidden ${inChat ? "hidden" : ""}`}
        >
          <div className="mx-auto flex max-w-2xl">
            <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
              <span className={bub}>
                <Home className="h-5 w-5" />
              </span>{" "}
              Início
            </Link>
            <Link
              to="/vagas"
              search={{ q: undefined, tipo: undefined }}
              className={item}
              activeProps={active}
            >
              <span className={bub}>
                <Briefcase className="h-5 w-5" />
              </span>{" "}
              Vagas
            </Link>
            <Link
              to="/comunidade"
              search={{ grupo: undefined }}
              aria-label="Comunidade"
              className="group relative -mt-7 flex flex-1 flex-col items-center gap-0.5 text-xs font-bold text-foreground"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground bg-primary text-primary-foreground shadow-md transition-shadow duration-150 group-hover:shadow-lg group-active:scale-95">
                <Users className="h-8 w-8" />
              </span>
              Comunidade
            </Link>
            {userId ? (
              <>
                <Link to="/conversas" className={item} activeProps={active}>
                  <span className={bub + " relative"}>
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
                <Link to="/perfil" className={item} activeProps={active}>
                  <span className={bub}>
                    <UserRound className="h-5 w-5" />
                  </span>{" "}
                  Meu perfil
                </Link>
              </>
            ) : (
              <Link to="/auth" className={item} activeProps={active}>
                <span className={bub}>
                  <LogIn className="h-5 w-5" />
                </span>{" "}
                Entrar
              </Link>
            )}
          </div>
        </nav>
      ) : (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-foreground bg-background lg:hidden">
          <div className="mx-auto max-w-2xl p-3">
            <Link
              to="/auth"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary font-bold text-primary-foreground shadow-block"
            >
              <LogIn className="h-5 w-5" />
              Entrar ou criar conta
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
