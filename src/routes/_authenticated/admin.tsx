import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Flag,
  Gift,
  LayoutDashboard,
  Lightbulb,
  Mail,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldOff,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ABAS, type Aba, AdminSidebar, MENU, type MenuItem } from "@/components/AdminMenu";
import { Avatar } from "@/components/profile-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type AdminReferrals,
  brl,
  EMAIL_KIND,
  grantPremium,
  PAYMENT_KIND,
  PAYMENT_STATUS,
  retryEmail,
  useAdminEmails,
  useAdminPayments,
  useAdminReferrals,
  type Overview,
  type Period,
  planLabel,
  suspendUser,
  unsuspendUser,
  useAdminOverview,
  useAdminUser,
  useAdminUsers,
  useIsModerator,
} from "@/lib/admin";
import { confirmAction } from "@/lib/confirm";
import { profileParam } from "@/lib/urls";

const PERIODS: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7dias", label: "7 dias" },
  { id: "mes", label: "Mês" },
];

const TITLES: Record<Aba, string> = {
  geral: "Visão geral",
  usuarios: "Usuários",
  pagamentos: "Pagamentos",
  indicacoes: "Indicações",
  emails: "E-mails",
};

/** Gestão do Beecos. Só moderadores; fora das buscas e sem link público. */
export const Route = createFileRoute("/_authenticated/admin")({
  staticData: { sitemap: false },
  validateSearch: (
    q: Record<string, unknown>,
  ): { aba?: Aba | undefined; p: Period; u?: string | undefined } => ({
    aba: ABAS.includes(q["aba"] as Aba) ? (q["aba"] as Aba) : undefined,
    p: q["p"] === "hoje" || q["p"] === "7dias" ? q["p"] : "mes",
    u: typeof q["u"] === "string" ? q["u"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Gestão — Beecos" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { data: isMod, isLoading } = useIsModerator();
  const { aba: picked, p, u } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin" });
  // no celular, sem aba escolhida mostra a lista; no computador abre a Visão geral
  const aba: Aba = picked ?? "geral";

  if (isLoading) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>;
  if (!isMod)
    return (
      <div className="block-card mx-auto mt-6 max-w-md space-y-3 p-6 text-center">
        <h1 className="text-2xl">Página não encontrada</h1>
        <Button asChild>
          <Link to="/">Ir para o início</Link>
        </Button>
      </div>
    );

  const go = (s: Partial<{ aba: Aba | undefined; p: Period; u: string | undefined }>) =>
    void navigate({ search: (old) => ({ ...old, ...s }) });

  const row = "flex min-h-14 w-full items-center gap-3 py-2.5 text-left";
  const body = (i: MenuItem) => {
    const Icon = i.icon;
    return (
      <>
        <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">{i.label}</span>
          <span className="block truncate text-sm text-muted-foreground">{i.text}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </>
    );
  };

  return (
    <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
      {/* celular: menu em lista (como o do perfil) */}
      {!picked && (
        <nav aria-label="Gestão" className="lg:hidden">
          <h1 className="mb-1 text-3xl">Gestão</h1>
          {MENU.map((g, gi) => (
            <section
              key={g.title}
              className={gi > 0 ? "-mx-4 mt-2 border-t-8 border-muted px-4" : ""}
            >
              <h2 className="mt-4 font-sans text-sm font-bold text-muted-foreground">{g.title}</h2>
              <ul>
                {g.items.map((i) => (
                  <li key={i.label}>
                    {i.to ? (
                      <Link to={i.to} className={row}>
                        {body(i)}
                      </Link>
                    ) : (
                      <button type="button" className={row} onClick={() => go({ aba: i.aba })}>
                        {body(i)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      )}
      {/* computador: coluna lateral (a mesma das outras telas da Gestão) */}
      <AdminSidebar aba={aba} onPick={(a) => go({ aba: a })} />
      <div className={`min-w-0 space-y-4 lg:max-w-2xl ${picked ? "" : "max-lg:hidden"}`}>
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            aria-label="Voltar ao menu da Gestão"
            onClick={() => go({ aba: undefined })}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md"
          >
            <ArrowLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <h1 className="text-2xl">{TITLES[aba]}</h1>
        </div>
        {aba === "geral" && (
          <OverviewPanel
            period={p}
            onPeriod={(v) => go({ p: v })}
            onUsers={() => go({ aba: "usuarios" })}
          />
        )}
        {aba === "usuarios" && <UsersPanel onOpen={(id) => go({ u: id })} />}
        {aba === "pagamentos" && <PaymentsPanel onOpen={(id) => go({ u: id })} />}
        {aba === "indicacoes" && <ReferralsPanel onOpen={(id) => go({ u: id })} />}
        {aba === "emails" && <EmailsPanel />}
      </div>
      <UserDialog id={u} onClose={() => go({ u: undefined })} />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="block-card p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl leading-tight sm:text-3xl">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function OverviewPanel({
  period,
  onPeriod,
  onUsers,
}: {
  period: Period;
  onPeriod: (p: Period) => void;
  onUsers: () => void;
}) {
  const { data, isLoading, isError, refetch } = useAdminOverview(period, true);
  const word = period === "hoje" ? "hoje" : period === "7dias" ? "em 7 dias" : "no mês";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="hidden text-2xl lg:block">Visão geral</h2>
        <div className="flex overflow-hidden rounded-lg border-2 border-foreground bg-card">
          {PERIODS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => onPeriod(x.id)}
              aria-pressed={period === x.id}
              className={`px-3 py-1 text-sm font-bold ${period === x.id ? "bg-foreground text-primary dark:text-background" : ""}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {isError && (
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Não foi possível carregar os números.</p>
          <Button onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      )}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Usuários" value={data.users} hint={`+${data.users_new} ${word}`} />
            <Kpi label="Prestadores prontos" value={data.providers} hint="com habilidade" />
            <Kpi label="Verificados" value={data.verified} hint="identidade confirmada" />
            <Kpi
              label="Vagas abertas"
              value={data.jobs_open}
              hint={`${data.jobs_new} publicadas ${word}`}
            />
            <Kpi label="Interesses" value={data.convs_new} hint={`em vagas e anúncios ${word}`} />
            <Kpi
              label="Serviços combinados"
              value={data.deals_new}
              hint={`${data.done_new} concluídos ${word}`}
            />
            <Kpi
              label="Premium ativos"
              value={data.premium}
              hint={`${data.premium_paying} pagando`}
            />
            <Kpi label="Receita" value={brl(Number(data.revenue))} hint={`pagamentos ${word}`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Todo todo={data.todo} />
            <Funnel f={data.funnel} onUsers={onUsers} />
          </div>
        </>
      )}
    </div>
  );
}

function Todo({ todo }: { todo: Overview["todo"] }) {
  const rows: { n: number; text: string; to?: string; note?: string }[] = [
    { n: todo.overdue, text: "Pagamentos atrasados", note: "a pessoa recebe e-mail com o link" },
    { n: todo.verifications, text: "Verificações de identidade esperando", to: "/verificacoes" },
    { n: todo.reports, text: "Denúncias abertas", to: "/moderacao" },
    { n: todo.suggestions, text: "Sugestões novas", to: "/sugestoes" },
    { n: todo.emails_failed, text: "E-mails que falharam" },
    { n: todo.asaas_failed, text: "Adiamentos no Asaas com erro" },
  ];
  return (
    <section className="block-card p-4">
      <h3 className="mb-2 text-lg">Precisa de você</h3>
      <ul className="divide-y divide-foreground/10">
        {rows.map((r) => (
          <li key={r.text} className="flex items-center gap-3 py-2 text-sm">
            <span
              className={`flex h-7 min-w-8 items-center justify-center rounded-full border-2 border-foreground px-1.5 text-xs font-bold ${r.n > 0 ? "bg-[oklch(0.9_0.06_25)] text-[oklch(0.3_0.1_25)]" : "bg-muted text-muted-foreground"}`}
            >
              {r.n}
            </span>
            <span className="min-w-0 flex-1">
              {r.text}
              {r.note && r.n > 0 && (
                <span className="block text-xs text-muted-foreground">{r.note}</span>
              )}
            </span>
            {r.to && (
              <Link to={r.to} className="text-sm font-bold underline">
                Abrir
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Funnel({ f, onUsers }: { f: Overview["funnel"]; onUsers: () => void }) {
  const steps: [string, number][] = [
    ["Criou a conta", f.signed_up],
    ["Cadastrou habilidade", f.skill],
    ["Verificou identidade", f.verified],
    ["Publicou vaga ou anúncio", f.posted],
    ["Conversou", f.talked],
    ["Combinou serviço", f.dealt],
  ];
  const max = Math.max(1, f.signed_up);
  const noSkill = f.signed_up - f.skill;
  return (
    <section className="block-card p-4">
      <h3 className="mb-2 text-lg">Do cadastro ao serviço</h3>
      <ul className="space-y-1.5">
        {steps.map(([label, n]) => (
          <li key={label} className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0">{label}</span>
            <span className="h-5 flex-1 overflow-hidden rounded border-[1.5px] border-foreground bg-muted">
              <span
                className="block h-full border-r-[1.5px] border-foreground bg-primary"
                style={{ width: `${Math.max(2, Math.round((n / max) * 100))}%` }}
              />
            </span>
            <span className="w-8 text-right font-bold">{n}</span>
          </li>
        ))}
      </ul>
      {noSkill > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {noSkill} de {f.signed_up} ainda não cadastraram habilidade.{" "}
          <button type="button" onClick={onUsers} className="font-bold underline">
            Ver usuários
          </button>
        </p>
      )}
    </section>
  );
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function UsersPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const { data, isLoading } = useAdminUsers(dq, true);
  return (
    <section className="space-y-3">
      <h2 className="hidden text-2xl lg:block">Usuários</h2>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, @usuário ou e-mail…"
          aria-label="Buscar usuários"
          className="pl-9"
        />
      </div>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data?.length === 0 && <p className="text-muted-foreground">Ninguém encontrado.</p>}
      <ul className="block-card divide-y divide-foreground/10 overflow-hidden">
        {data?.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onOpen(u.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-foreground/[0.05]"
            >
              <Avatar name={u.full_name} path={u.avatar_path} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{u.full_name || "Sem nome"}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {u.username ? `@${u.username} · ` : ""}
                  {u.email}
                </span>
              </span>
              <span className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
                <Tag on={u.premium}>{planLabel(u)}</Tag>
                <Tag on={u.doc}>Doc</Tag>
                <Tag on={u.phone}>Tel</Tag>
                {u.suspended && <Tag danger>Suspensa</Tag>}
              </span>
              <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tag({
  children,
  on = true,
  danger,
}: {
  children: React.ReactNode;
  on?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={`rounded-full border-[1.5px] px-2 py-px text-[11px] font-bold ${danger ? "border-destructive bg-destructive text-destructive-foreground" : on ? "border-foreground bg-primary text-primary-foreground" : "border-foreground/30 text-muted-foreground line-through"}`}
    >
      {children}
    </span>
  );
}

const ACTION_LABEL: Record<string, string> = {
  premium: "Deu Premium",
  suspend: "Suspendeu",
  unsuspend: "Liberou",
};

function UserDialog({ id, onClose }: { id: string | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: u, isLoading } = useAdminUser(id);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-user", id] }),
      qc.invalidateQueries({ queryKey: ["admin-users"] }),
      qc.invalidateQueries({ queryKey: ["admin-overview"] }),
    ]);

  async function premium() {
    if (!u) return;
    const ok = await confirmAction({
      title: `Tem certeza que deseja dar 30 dias de Premium para ${u.full_name || "esta pessoa"}?`,
      description: u.premium
        ? "Ela já é Premium: os 30 dias são somados ao que já tem. Ela recebe um aviso no app."
        : "Sem cobrança. Quando terminar, volta ao plano grátis. Ela recebe um aviso no app.",
      confirmLabel: "Dar 30 dias",
      danger: false,
    });
    if (!ok) return;
    try {
      await grantPremium(u.id, 30);
      toast.success("Pronto: 30 dias de Premium.");
      await refresh();
    } catch {
      toast.error("Não foi possível dar o Premium. Tente de novo.");
    }
  }

  async function unsuspend() {
    if (!u) return;
    const ok = await confirmAction({
      title: `Tem certeza que deseja liberar a conta de ${u.full_name || "esta pessoa"}?`,
      confirmLabel: "Liberar conta",
      danger: false,
    });
    if (!ok) return;
    try {
      await unsuspendUser(u.id);
      toast.success("Conta liberada.");
      await refresh();
    } catch {
      toast.error("Não foi possível liberar. Tente de novo.");
    }
  }

  const rows: [string, string][] = u
    ? [
        ["Cadastro", fmt(u.created_at)],
        ["Visto por último", fmt(u.last_seen_at)],
        [
          "Plano",
          `${planLabel(u)}${u.premium && u.active_until ? ` até ${fmt(u.active_until)}` : ""}${u.cancel_requested_at && u.plan_term === "monthly" ? " (cancelado)" : ""}`,
        ],
        ["Já pagou", brl(Number(u.paid_total))],
        [
          "Verificações",
          `E-mail ${u.email_ok ? "✓" : "—"} · Doc ${u.doc ? "✓" : "—"} · Tel ${u.phone ? "✓" : "—"}`,
        ],
        ["Habilidades", u.skills.length ? u.skills.join(", ") : "Nenhuma"],
        [
          "Vagas / anúncios",
          `${u.jobs} ${u.jobs === 1 ? "vaga" : "vagas"} · ${u.ads} ${u.ads === 1 ? "anúncio" : "anúncios"}`,
        ],
        ["Conversas", String(u.conversations)],
        ["Serviços combinados", String(u.deals)],
        [
          "Indicou",
          `${u.invited} (${u.invited_counted} ${u.invited_counted === 1 ? "contou" : "contaram"})`,
        ],
        ["Foi indicada por", u.invited_by ? `@${u.invited_by}` : "—"],
        ["Denúncias contra", String(u.reports_against)],
      ]
    : [];

  return (
    <>
      <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="block-card max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
          {isLoading || !u ? (
            <>
              <DialogHeader>
                <DialogTitle>Ficha</DialogTitle>
                <DialogDescription>
                  {isLoading ? "Carregando…" : "Usuário não encontrado."}
                </DialogDescription>
              </DialogHeader>
            </>
          ) : (
            <>
              <DialogHeader className="text-left">
                <div className="flex items-center gap-3">
                  <Avatar name={u.full_name} path={u.avatar_path} size={48} />
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-xl">
                      {u.full_name || "Sem nome"}
                    </DialogTitle>
                    <DialogDescription className="selectable truncate">
                      {u.username ? `@${u.username} · ` : ""}
                      {u.email}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              {u.suspended_until && (
                <p className="rounded-lg border-2 border-destructive bg-destructive/10 p-2 text-sm font-semibold">
                  Conta suspensa até {fmt(u.suspended_until)}.
                </p>
              )}
              <dl className="divide-y divide-foreground/10 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-1.5">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void premium()}>
                  <Gift /> Dar 30 dias de Premium
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/perfil/$slug"
                    params={{ slug: profileParam({ id: u.id, slug: u.username }) }}
                    search={{ post: undefined }}
                  >
                    <ExternalLink /> Abrir perfil
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`mailto:${u.email}`}>
                    <Mail /> Enviar e-mail
                  </a>
                </Button>
                {u.suspended_until ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void unsuspend()}
                  >
                    <ShieldOff /> Liberar conta
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setSuspendOpen(true)}
                  >
                    <ShieldAlert /> Suspender conta
                  </Button>
                )}
              </div>
              {u.actions.length > 0 && (
                <div className="border-t border-foreground/15 pt-2">
                  <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">
                    Histórico da equipe
                  </p>
                  <ul className="space-y-0.5 text-xs">
                    {u.actions.map((a, i) => (
                      <li key={i}>
                        {fmt(a.created_at)} · {ACTION_LABEL[a.action] ?? a.action}
                        {a.by ? ` (${a.by.split(" ")[0]})` : ""}
                        {typeof a.details["reason"] === "string" && a.details["reason"]
                          ? `: ${String(a.details["reason"])}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {u && (
        <SuspendDialog
          open={suspendOpen}
          name={u.full_name}
          onClose={() => setSuspendOpen(false)}
          onConfirm={async (days, reason) => {
            try {
              await suspendUser(u.id, days, reason);
              toast.success("Conta suspensa.");
              setSuspendOpen(false);
              await refresh();
            } catch (e) {
              const msg = (e as { message?: string }).message ?? "";
              toast.error(
                msg.includes("NAO_SUSPENDE_MODERADOR")
                  ? "Não dá para suspender um moderador."
                  : "Não foi possível suspender. Tente de novo.",
              );
            }
          }}
        />
      )}
    </>
  );
}

function SuspendDialog({
  open,
  name,
  onClose,
  onConfirm,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: (days: number, reason: string) => Promise<void>;
}) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="block-card w-[calc(100%-2rem)] max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Tem certeza que deseja suspender {name || "esta conta"}?</DialogTitle>
          <DialogDescription>
            Até lá, a pessoa não pode negociar, publicar vagas nem receber propostas. Ela vê um
            aviso com o motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Por quanto tempo">
          {[1, 7, 30, 365].map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className={`rounded-full border-2 border-foreground px-3 py-1 text-sm font-bold ${days === d ? "bg-foreground text-primary dark:text-background" : "bg-card"}`}
            >
              {d === 1 ? "1 dia" : d === 365 ? "1 ano" : `${d} dias`}
            </button>
          ))}
        </div>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          placeholder="Motivo (a pessoa vê)"
          aria-label="Motivo"
        />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              await onConfirm(days, reason.trim());
              setBusy(false);
            }}
          >
            Suspender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-9 rounded-full border-2 border-foreground px-3 text-sm font-bold ${value === o.id ? "bg-foreground text-primary dark:text-background" : "bg-card"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  paid: "bg-[oklch(0.9_0.08_150)] text-[oklch(0.25_0.06_150)]",
  pending: "bg-primary text-primary-foreground",
  overdue: "bg-[oklch(0.9_0.06_25)] text-[oklch(0.3_0.1_25)]",
  canceled: "bg-muted text-muted-foreground",
  refunded: "bg-muted text-muted-foreground",
};

function PaymentsPanel({ onOpen }: { onOpen: (userId: string) => void }) {
  const [status, setStatus] = useState<"todos" | "paid" | "pending" | "overdue" | "canceled">(
    "todos",
  );
  const { data, isLoading, isError, refetch } = useAdminPayments(
    status === "todos" ? null : status,
  );
  const t = data?.totals ?? {};
  return (
    <section className="space-y-4">
      <h2 className="hidden text-2xl lg:block">Pagamentos</h2>
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Entrou no mês"
            value={brl(Number(data.paid_month))}
            hint="pagamentos confirmados"
          />
          <Kpi
            label="Aguardando"
            value={t["pending"]?.n ?? 0}
            hint={brl(Number(t["pending"]?.value ?? 0))}
          />
          <Kpi
            label="Atrasados"
            value={t["overdue"]?.n ?? 0}
            hint={brl(Number(t["overdue"]?.value ?? 0))}
          />
          <Kpi
            label="Cancelados"
            value={t["canceled"]?.n ?? 0}
            hint={brl(Number(t["canceled"]?.value ?? 0))}
          />
        </div>
      )}
      <Chips
        label="Situação"
        value={status}
        onChange={setStatus}
        options={[
          { id: "todos", label: "Todos" },
          { id: "paid", label: "Pagos" },
          { id: "pending", label: "Aguardando" },
          { id: "overdue", label: "Atrasados" },
          { id: "canceled", label: "Cancelados" },
        ]}
      />
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {isError && (
        <Button variant="outline" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      )}
      {data?.rows.length === 0 && <p className="text-muted-foreground">Nenhum pagamento aqui.</p>}
      {!!data?.rows.length && (
        <ul className="block-card divide-y divide-foreground/10 overflow-hidden">
          {data.rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen(r.user_id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-foreground/[0.05]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {PAYMENT_KIND[r.kind] ?? r.kind} · {fmtDay(r.created_at)}
                    {r.paid_at ? ` · pago em ${fmtDay(r.paid_at)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold">{brl(Number(r.value))}</span>
                  <span
                    className={`inline-block rounded-full border-[1.5px] border-foreground px-2 py-px text-[11px] font-bold ${STATUS_TONE[r.status] ?? "bg-muted"}`}
                  >
                    {PAYMENT_STATUS[r.status] ?? r.status}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Quem está atrasado recebe e-mail com o link de pagamento. Tocar numa linha abre a ficha da
        pessoa.
      </p>
    </section>
  );
}

function ReferralsPanel({ onOpen }: { onOpen: (userId: string) => void }) {
  const { data, isLoading } = useAdminReferrals();
  const step = (r: AdminReferrals["recent"][number]) =>
    r.counted
      ? "Contou ✓"
      : !r.email
        ? "Falta e-mail"
        : !r.skill
          ? "Falta habilidade"
          : !r.doc
            ? "Falta identidade"
            : "Contou ✓";
  return (
    <section className="space-y-4">
      <h2 className="hidden text-2xl lg:block">Indicações</h2>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Convidados" value={data.invited} hint="entraram por um link" />
            <Kpi label="Contaram" value={data.counted} hint="completaram o cadastro" />
            <Kpi label="Prêmios" value={data.rewards} hint="meses de Premium dados" />
          </div>
          <div className="block-card p-4">
            <h3 className="mb-2 text-lg">Quem mais indicou</h3>
            {data.ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguém indicou ainda.</p>
            ) : (
              <ol className="divide-y divide-foreground/10">
                {data.ranking.map((r, i) => (
                  <li key={r.user_id}>
                    <button
                      type="button"
                      onClick={() => onOpen(r.user_id)}
                      className="flex w-full items-center gap-3 py-2 text-left text-sm"
                    >
                      <span className="w-5 font-bold text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.invited} convidados · {r.counted} contaram
                          {r.rewards ? ` · ${r.rewards} prêmio(s)` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {data.recent.length > 0 && (
            <div className="block-card p-4">
              <h3 className="mb-2 text-lg">Últimos convidados</h3>
              <ul className="divide-y divide-foreground/10 text-sm">
                {data.recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.invitee}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        convidado por {r.referrer} · {fmtDay(r.created_at)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border-[1.5px] border-foreground px-2 py-px text-[11px] font-bold ${r.counted ? "bg-[oklch(0.9_0.08_150)] text-[oklch(0.25_0.06_150)]" : "bg-primary text-primary-foreground"}`}
                    >
                      {step(r)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function EmailsPanel() {
  const qc = useQueryClient();
  const [only, setOnly] = useState<"todos" | "falhas">("todos");
  const { data, isLoading } = useAdminEmails(only === "falhas");
  async function retry(id: string) {
    try {
      await retryEmail(id);
      toast.success("Voltou para a fila. Sai em até 1 minuto.");
      await qc.invalidateQueries({ queryKey: ["admin-emails"] });
    } catch {
      toast.error("Não foi possível. Tente de novo.");
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="hidden text-2xl lg:block">E-mails</h2>
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Enviados hoje" value={data.sent_today} hint={`${data.sent_7d} em 7 dias`} />
          <Kpi label="Na fila" value={data.waiting} hint="saem em até 1 minuto" />
          <Kpi label="Falharam" value={data.failed} hint="depois de 5 tentativas" />
          <Kpi label="Remetente" value="avisos@" hint="contato.beecos.com.br" />
        </div>
      )}
      <Chips
        label="Mostrar"
        value={only}
        onChange={setOnly}
        options={[
          { id: "todos", label: "Todos" },
          { id: "falhas", label: "Só com erro" },
        ]}
      />
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data?.rows.length === 0 && (
        <p className="text-muted-foreground">
          {only === "falhas" ? "Nenhum e-mail com erro. 🎉" : "Nenhum e-mail ainda."}
        </p>
      )}
      {!!data?.rows.length && (
        <ul className="block-card divide-y divide-foreground/10 overflow-hidden">
          {data.rows.map((r) => {
            const failed = !r.sent_at && r.attempts > 0;
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {EMAIL_KIND[r.kind] ?? r.kind}{" "}
                    <span className="font-normal text-muted-foreground">· {r.name}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.to_email} · {fmtDay(r.created_at)}{" "}
                    {new Date(r.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {failed && r.last_error && (
                    <span className="block truncate text-xs text-destructive">{r.last_error}</span>
                  )}
                </span>
                {r.sent_at ? (
                  <span className="shrink-0 text-xs font-bold text-[oklch(0.45_0.12_150)]">
                    Enviado ✓
                  </span>
                ) : failed ? (
                  <Button size="sm" variant="outline" onClick={() => void retry(r.id)}>
                    <RotateCcw /> Tentar de novo
                  </Button>
                ) : (
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">Na fila</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
