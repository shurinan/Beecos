import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CreditCard,
  Flag,
  Gift,
  LayoutDashboard,
  Lightbulb,
  Mail,
  UserCheck,
  Users,
} from "lucide-react";
import { useIsModerator } from "@/lib/admin";

export type Aba = "geral" | "usuarios" | "pagamentos" | "indicacoes" | "emails";
export const ABAS: Aba[] = ["geral", "usuarios", "pagamentos", "indicacoes", "emails"];

export type MenuItem = {
  label: string;
  text: string;
  icon: typeof Gift;
  aba?: Aba;
  to?: "/moderacao" | "/verificacoes" | "/sugestoes";
};

export const MENU: { title: string; items: MenuItem[] }[] = [
  {
    title: "Números",
    items: [
      {
        label: "Visão geral",
        text: "Números do dia, da semana e do mês",
        icon: LayoutDashboard,
        aba: "geral",
      },
      {
        label: "Usuários",
        text: "Buscar, ver a ficha, dar Premium, suspender",
        icon: Users,
        aba: "usuarios",
      },
    ],
  },
  {
    title: "Dinheiro e crescimento",
    items: [
      {
        label: "Pagamentos",
        text: "Pagos, aguardando, atrasados e cancelados",
        icon: CreditCard,
        aba: "pagamentos",
      },
      { label: "Indicações", text: "Quem mais trouxe prestadores", icon: Gift, aba: "indicacoes" },
      {
        label: "E-mails",
        text: "O que saiu, o que espera e o que falhou",
        icon: Mail,
        aba: "emails",
      },
    ],
  },
  {
    title: "Moderação",
    items: [
      { label: "Denúncias", text: "Casos abertos e decisões", icon: Flag, to: "/moderacao" },
      {
        label: "Verificações",
        text: "Documentos esperando análise",
        icon: UserCheck,
        to: "/verificacoes",
      },
      { label: "Sugestões", text: "Ideias dos usuários", icon: Lightbulb, to: "/sugestoes" },
    ],
  },
];

/**
 * Coluna lateral da Gestão, no computador. Fica igual em todas as telas da Gestão
 * (números, denúncias, verificações, sugestões), para o menu não sumir ao trocar de tela.
 * Dentro de /admin, `onPick` troca a aba sem sair da página.
 */
export function AdminSidebar({
  aba,
  onPick,
}: {
  aba?: Aba | undefined;
  onPick?: ((a: Aba) => void) | undefined;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Gestão" className="hidden lg:block">
      <p className="mb-3 font-display text-2xl">Gestão</p>
      {MENU.map((g) => (
        <div key={g.title} className="mb-3">
          <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {g.title}
          </p>
          {g.items.map((i) => {
            const on = i.to ? path === i.to : path === "/admin" && !!i.aba && i.aba === aba;
            const cls = `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold ${on ? "bg-foreground text-primary dark:text-background" : "hover:bg-foreground/[0.06]"}`;
            const Icon = i.icon;
            const inner = (
              <>
                <Icon className="h-4 w-4" aria-hidden="true" /> {i.label}
              </>
            );
            if (i.to) {
              return (
                <Link
                  key={i.label}
                  to={i.to}
                  aria-current={on ? "page" : undefined}
                  className={cls}
                >
                  {inner}
                </Link>
              );
            }
            if (onPick && i.aba) {
              const pick = i.aba;
              return (
                <button
                  key={i.label}
                  type="button"
                  className={cls}
                  aria-current={on ? "page" : undefined}
                  onClick={() => onPick(pick)}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={i.label}
                to="/admin"
                search={{ aba: i.aba, p: "mes" }}
                aria-current={on ? "page" : undefined}
                className={cls}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Telas da Gestão fora de /admin (denúncias, verificações, sugestões): mesma coluna lateral. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const { data: isMod } = useIsModerator();
  if (!isMod) return <>{children}</>;
  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <AdminSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
