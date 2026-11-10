import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  CreditCard,
  FileText,
  Gift,
  Hammer,
  HelpCircle,
  Lock,
  LogOut,
  Search,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/profile-bits";

export type Section =
  "perfil" | "habilidades" | "publicacoes" | "indique" | "plano" | "privacidade";
export const SECTIONS: Section[] = [
  "perfil",
  "habilidades",
  "publicacoes",
  "indique",
  "plano",
  "privacidade",
];

type Item =
  | { kind: "section"; key: Section; title: string; text: string; icon: typeof Bell }
  | { kind: "link"; to: "/avisos" | "/ajuda"; title: string; text: string; icon: typeof Bell };

const ITEMS: Item[] = [
  {
    kind: "section",
    key: "perfil",
    title: "Perfil",
    text: "Foto, nome, contato e onde você atua",
    icon: UserRound,
  },
  {
    kind: "section",
    key: "habilidades",
    title: "Habilidades e experiência",
    text: "O que você sabe fazer",
    icon: Hammer,
  },
  {
    kind: "section",
    key: "publicacoes",
    title: "Minhas publicações",
    text: "Vagas e disponibilidades",
    icon: FileText,
  },
  {
    kind: "section",
    key: "indique",
    title: "Indique e ganhe",
    text: "Traga 5 prestadores, ganhe 1 mês de Premium",
    icon: Gift,
  },
  {
    kind: "section",
    key: "plano",
    title: "Plano e pagamento",
    text: "Premium, cancelamento e reembolso",
    icon: CreditCard,
  },
  {
    kind: "section",
    key: "privacidade",
    title: "Privacidade e dados",
    text: "Seus dados, exportar e excluir conta",
    icon: Lock,
  },
  {
    kind: "link",
    to: "/avisos",
    title: "Notificações",
    text: "Mensagens e avisos",
    icon: Bell,
  },
  {
    kind: "link",
    to: "/ajuda",
    title: "Ajuda e feedback",
    text: "Central de ajuda, Termos, Privacidade",
    icon: HelpCircle,
  },
];

/**
 * Menu lateral do perfil, no computador (coluna com busca). No celular, o menu é a lista do
 * ProfileMenuList (estilo Configurações do Instagram).
 */
export function SettingsMenu({
  current,
  name,
  headline,
  avatarPath,
  onSignOut,
}: {
  current: Section | null;
  name: string;
  headline: string;
  avatarPath: string | null | undefined;
  onSignOut: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const items = ITEMS.filter((i) => !term || `${i.title} ${i.text}`.toLowerCase().includes(term));
  const base = "flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-foreground/[0.06]";

  return (
    <>
      {/* computador: coluna lateral */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <h1 className="text-2xl">Configurações</h1>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar configurações"
              aria-label="Pesquisar configurações"
              className="h-10 w-full rounded-full border border-foreground/25 bg-muted pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Link
            to="/perfil"
            search={{ secao: "perfil" }}
            className="flex items-center gap-3 border-b border-foreground/15 px-1 pb-4"
          >
            <Avatar name={name} path={avatarPath} size={56} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{name || "Sem nome"}</span>
              {headline && (
                <span className="block truncate text-sm text-muted-foreground">{headline}</span>
              )}
            </span>
          </Link>
          <ul className="space-y-0.5">
            {items.map((i) => {
              const Icon = i.icon;
              const body = (
                <>
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">{i.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{i.text}</span>
                  </span>
                </>
              );
              return (
                <li key={i.title}>
                  {i.kind === "section" ? (
                    <Link
                      to="/perfil"
                      search={{ secao: i.key }}
                      aria-current={current === i.key ? "page" : undefined}
                      className={base + (current === i.key ? " bg-foreground/[0.09]" : "")}
                    >
                      {body}
                    </Link>
                  ) : (
                    <Link
                      to={i.to}
                      aria-current={path === i.to ? "page" : undefined}
                      className={base + (path === i.to ? " bg-foreground/[0.09]" : "")}
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</li>
            )}
          </ul>
          <button
            type="button"
            onClick={onSignOut}
            className={base + " w-full font-semibold text-destructive"}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Sua conta", keys: ["perfil", "habilidades", "publicacoes"] },
  { title: "Plano e indicações", keys: ["plano", "indique"] },
  { title: "Configurações", keys: ["/avisos", "privacidade", "/ajuda"] },
];
const itemKey = (i: Item) => (i.kind === "section" ? i.key : i.to);

/** Celular: o menu do perfil em lista, agrupado. Tocar num item abre a seção (com "←"). */
export function ProfileMenuList({
  name,
  username,
  avatarPath,
  publicSlug,
  values,
  moderator,
  onSignOut,
}: {
  name: string;
  username: string | null | undefined;
  avatarPath: string | null | undefined;
  publicSlug: string;
  /** Texto curto à direita do item (ex.: plano: "Premium", indique: "3 de 5"). */
  values: Partial<Record<Section, string>>;
  moderator: boolean;
  onSignOut: () => void;
}) {
  const row = "flex min-h-14 items-center gap-3 py-2.5";
  const body = (i: Item) => {
    const Icon = i.icon;
    const v = i.kind === "section" ? values[i.key] : undefined;
    return (
      <>
        <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">{i.title}</span>
          <span className="block truncate text-sm text-muted-foreground">{i.text}</span>
        </span>
        {v && <span className="shrink-0 text-sm text-muted-foreground">{v}</span>}
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </>
    );
  };
  return (
    <nav aria-label="Menu do perfil" className="lg:hidden">
      <Link
        to="/perfil/$slug"
        params={{ slug: publicSlug }}
        search={{ post: undefined }}
        className="flex items-center gap-3 border-b border-foreground/15 pb-4"
      >
        <Avatar name={name} path={avatarPath} size={60} />
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold">{name || "Sem nome"}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {username ? `@${username} · ` : ""}Ver meu perfil público
          </span>
        </span>
      </Link>
      {GROUPS.map((g, gi) => (
        <section key={g.title} className={gi > 0 ? "-mx-4 mt-2 border-t-8 border-muted px-4" : ""}>
          <h2 className="mt-4 font-sans text-sm font-bold text-muted-foreground">{g.title}</h2>
          <ul>
            {g.keys.map((k) => {
              const i = ITEMS.find((x) => itemKey(x) === k);
              if (!i) return null;
              return (
                <li key={k}>
                  {i.kind === "section" ? (
                    <Link to="/perfil" search={{ secao: i.key }} className={row}>
                      {body(i)}
                    </Link>
                  ) : (
                    <Link to={i.to} className={row}>
                      {body(i)}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section className="-mx-4 mt-2 border-t-8 border-muted px-4">
        <ul className="mt-2">
          {moderator && (
            <li>
              <Link to="/admin" search={{ aba: undefined, p: "mes" }} className={row}>
                <LayoutDashboard className="h-6 w-6 shrink-0" aria-hidden="true" />
                <span className="flex-1 font-semibold">Gestão e moderação</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          )}
          <li>
            <button
              type="button"
              onClick={onSignOut}
              className={row + " w-full font-semibold text-destructive"}
            >
              <LogOut className="h-6 w-6 shrink-0" aria-hidden="true" />
              Sair
            </button>
          </li>
        </ul>
      </section>
    </nav>
  );
}
