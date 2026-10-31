import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  CreditCard,
  FileText,
  Hammer,
  HelpCircle,
  Lock,
  LogOut,
  Search,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/profile-bits";

export type Section = "perfil" | "habilidades" | "publicacoes" | "plano" | "privacidade";
export const SECTIONS: Section[] = ["perfil", "habilidades", "publicacoes", "plano", "privacidade"];

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
 * Menu lateral do perfil, no estilo das Configurações do WhatsApp.
 * No computador é uma coluna com busca; no celular vira uma faixa de abas deslizável.
 */
export function SettingsMenu({
  current,
  name,
  headline,
  avatarPath,
  onSignOut,
}: {
  current: Section;
  name: string;
  headline: string;
  avatarPath: string | null | undefined;
  onSignOut: () => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const items = ITEMS.filter((i) => !term || `${i.title} ${i.text}`.toLowerCase().includes(term));
  const base = "flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-foreground/[0.06]";

  return (
    <>
      {/* celular: abas deslizáveis */}
      <nav
        aria-label="Seções do perfil"
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        {ITEMS.map((i) =>
          i.kind === "section" ? (
            <Link
              key={i.key}
              to="/perfil"
              search={{ secao: i.key }}
              aria-current={current === i.key ? "page" : undefined}
              className={
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold " +
                (current === i.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-foreground/25")
              }
            >
              {i.title}
            </Link>
          ) : (
            <Link
              key={i.to}
              to={i.to}
              className="shrink-0 rounded-full border border-foreground/25 px-3.5 py-1.5 text-sm font-bold"
            >
              {i.title}
            </Link>
          ),
        )}
      </nav>

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
                    <Link to={i.to} className={base}>
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
