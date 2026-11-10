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
  const row =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-foreground/[0.06]";
  return (
    <aside className="hidden lg:block">
      <nav aria-label="Gestão" className="sticky top-24 space-y-4">
        <p className="font-display text-2xl">Gestão</p>
        {MENU.map((g) => (
          <div key={g.title}>
            <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const on = i.to ? path === i.to : path === "/admin" && !!i.aba && i.aba === aba;
                const cls = row + (on ? " bg-foreground/[0.09]" : "");
                const Icon = i.icon;
                const inner = (
                  <>
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold leading-tight">{i.label}</span>
                      <span className="block truncate text-sm text-muted-foreground">{i.text}</span>
                    </span>
                  </>
                );
                const current = on ? ("page" as const) : undefined;
                let el: ReactNode;
                if (i.to) {
                  el = (
                    <Link to={i.to} aria-current={current} className={cls}>
                      {inner}
                    </Link>
                  );
                } else if (onPick && i.aba) {
                  const pick = i.aba;
                  el = (
                    <button
                      type="button"
                      className={cls}
                      aria-current={current}
                      onClick={() => onPick(pick)}
                    >
                      {inner}
                    </button>
                  );
                } else {
                  el = (
                    <Link
                      to="/admin"
                      search={{ aba: i.aba, p: "mes" }}
                      aria-current={current}
                      className={cls}
                    >
                      {inner}
                    </Link>
                  );
                }
                return <li key={i.label}>{el}</li>;
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Telas da Gestão fora de /admin (denúncias, verificações, sugestões): mesma coluna lateral. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const { data: isMod } = useIsModerator();
  if (!isMod) return <>{children}</>;
  return (
    <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
      <AdminSidebar />
      <div className="min-w-0 lg:max-w-2xl">{children}</div>
    </div>
  );
}
