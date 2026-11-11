import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { AdminFrame } from "@/components/AdminMenu";
import { ArticleView } from "@/components/blog/ArticleView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsModerator } from "@/lib/admin";
import {
  blogError,
  type Draft,
  formatDate,
  type PendingArticle,
  removeArticle,
  reviewArticle,
  useAdminArticles,
} from "@/lib/blog";
import { readingMinutes } from "@/lib/blog-html";
import { confirmAction } from "@/lib/confirm";
import { timeAgo } from "@/lib/data";

const ArticleEditor = lazy(() => import("@/components/blog/ArticleEditor"));

export const Route = createFileRoute("/_authenticated/revisar-artigos")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "Revisar artigos — Beecos" }, { name: "robots", content: "noindex" }],
  }),
  component: ReviewArticlesPage,
});

function ReviewArticlesPage() {
  return (
    <AdminFrame>
      <ReviewArticles />
    </AdminFrame>
  );
}

function ReviewArticles() {
  const { userId } = Route.useRouteContext();
  const { data: isMod, isLoading: loadingMod } = useIsModerator();
  const { data, isLoading, isError, refetch } = useAdminArticles(!!isMod);
  const [tab, setTab] = useState<"fila" | "no-ar">("fila");
  const [openId, setOpenId] = useState<string | null>(null);

  if (loadingMod) return <p className="py-8 text-center text-muted-foreground">Carregando…</p>;
  if (!isMod) {
    return (
      <div className="block-card mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl">Página não encontrada</h1>
      </div>
    );
  }

  const open = data?.pending.find((p) => p.id === openId);
  if (open) {
    return <ReviewPanel item={open} userId={userId} onClose={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Artigos</h1>
      <p className="text-sm text-muted-foreground">
        Nada vai para o blog sem passar por aqui. Aprove, ajuste e publique (o autor recebe um aviso
        do ajuste) ou recuse com o motivo (o autor corrige e envia de novo).
      </p>
      <div
        role="tablist"
        className="flex overflow-hidden rounded-xl border-2 border-foreground bg-card"
      >
        {(
          [
            { id: "fila", label: `Para revisar${data ? ` (${data.pending.length})` : ""}` },
            { id: "no-ar", label: `No ar${data ? ` (${data.published.length})` : ""}` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 font-bold ${tab === t.id ? "bg-foreground text-primary dark:text-background" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-6 text-center text-muted-foreground">Carregando…</p>}
      {isError && (
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Não foi possível carregar os artigos.</p>
          <Button onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      )}

      {data && tab === "fila" && (
        <ul className="space-y-3">
          {data.pending.length === 0 && (
            <li className="rounded-xl border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
              Nenhum artigo esperando revisão.
            </li>
          )}
          {data.pending.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="block-card flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{p.draft.title || "Sem título"}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.author_name}
                    {p.team ? " · equipe" : ""} · enviado {timeAgo(p.submitted_at)}
                    {p.status === "published" ? " · nova versão de artigo no ar" : ""}
                  </span>
                </span>
                <span className="rounded-lg border-2 border-foreground bg-primary px-3 py-1 text-sm font-bold">
                  Revisar
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && tab === "no-ar" && <LiveList rows={data.published} />}
    </div>
  );
}

function ReviewPanel({
  item,
  userId,
  onClose,
}: {
  item: PendingArticle;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"ver" | "ajustar" | "recusar">("ver");
  const [edited, setEdited] = useState<Draft>(item.draft);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = mode === "ajustar" ? edited : item.draft;
  const view = {
    title: shown.title,
    topic: shown.topic,
    cover_path: shown.cover_path,
    body_html: shown.body_html,
    reading_min: readingMinutes(shown.body_html),
    signature: shown.signature,
    author: item.author,
  };

  async function decide(decision: "approve" | "adjust" | "reject") {
    const texts = {
      approve: {
        title: "Tem certeza que deseja aprovar e publicar?",
        description: "O artigo vai para o blog e o autor recebe um aviso.",
        confirmLabel: "Publicar",
        danger: false,
      },
      adjust: {
        title: "Tem certeza que deseja publicar com os seus ajustes?",
        description: "O artigo vai para o blog e o autor recebe um aviso com o que foi ajustado.",
        confirmLabel: "Publicar com ajustes",
        danger: false,
      },
      reject: {
        title: "Tem certeza que deseja recusar este artigo?",
        description: "O autor recebe o motivo e pode corrigir e enviar de novo.",
        confirmLabel: "Recusar",
        danger: true,
      },
    }[decision];
    if (decision === "reject" && !note.trim()) {
      toast.error("Escreva o motivo: o autor vai ler.");
      return;
    }
    if (!(await confirmAction(texts))) return;
    setBusy(true);
    try {
      await reviewArticle(
        item.id,
        decision,
        decision === "approve" ? undefined : note.trim() || undefined,
        decision === "adjust" ? edited : undefined,
      );
      await qc.invalidateQueries({ queryKey: ["admin-articles"] });
      toast.success(
        decision === "reject"
          ? "Recusado. O autor foi avisado."
          : "Publicado! O autor foi avisado.",
      );
      onClose();
    } catch (e) {
      toast.error(blogError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1 text-sm font-bold underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar à fila
      </button>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          De <b className="text-foreground">{item.author_name}</b>, enviado{" "}
          {timeAgo(item.submitted_at)}
        </span>
        {item.status === "published" && item.slug && (
          <Link
            to="/blog/$slug"
            params={{ slug: item.slug }}
            className="inline-flex items-center gap-1 font-bold underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> versão que está no ar
          </Link>
        )}
      </div>

      {mode === "ajustar" ? (
        <Suspense
          fallback={<p className="py-10 text-center text-muted-foreground">Abrindo o editor…</p>}
        >
          <ArticleEditor
            value={edited}
            onChange={setEdited}
            userId={userId}
            showSignature={false}
          />
        </Suspense>
      ) : (
        <div className="block-card p-4 sm:p-6">
          <ArticleView article={view} preview />
        </div>
      )}

      {mode === "ver" && (
        <div className="sticky bottom-20 z-10 flex flex-wrap justify-end gap-2 rounded-xl border-2 border-foreground bg-card p-2 shadow-block lg:bottom-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode("recusar")}
            disabled={busy}
          >
            <X /> Recusar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode("ajustar")}
            disabled={busy}
          >
            <PenLine /> Ajustar
          </Button>
          <Button type="button" onClick={() => decide("approve")} disabled={busy}>
            <Check /> Aprovar e publicar
          </Button>
        </div>
      )}

      {mode !== "ver" && (
        <div className="block-card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="font-bold">
              {mode === "recusar"
                ? "O que o autor precisa corrigir? (obrigatório)"
                : "O que você ajustou? (o autor vai ler)"}
            </span>
            <Textarea
              value={note}
              maxLength={1000}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "recusar"
                  ? "Ex.: o texto tem propaganda de outro site. Tire os links e envie de novo."
                  : "Ex.: corrigimos o título e alguns erros de digitação."
              }
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMode("ver");
                setEdited(item.draft);
              }}
              disabled={busy}
            >
              Cancelar
            </Button>
            {mode === "recusar" ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => decide("reject")}
                disabled={busy}
              >
                Recusar e avisar o autor
              </Button>
            ) : (
              <Button type="button" onClick={() => decide("adjust")} disabled={busy}>
                <Check /> Publicar com ajustes
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveList({
  rows,
}: {
  rows: {
    id: string;
    slug: string;
    title: string;
    published_at: string;
    adjusted: boolean;
    author_name: string;
  }[];
}) {
  const qc = useQueryClient();
  const [removing, setRemoving] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function remove(id: string) {
    if (!note.trim()) {
      toast.error("Escreva o motivo: o autor vai ler.");
      return;
    }
    const ok = await confirmAction({
      title: "Tem certeza que deseja tirar este artigo do ar?",
      description: "Ele some do blog na hora e o autor recebe o motivo.",
      confirmLabel: "Tirar do ar",
    });
    if (!ok) return;
    try {
      await removeArticle(id, note.trim());
      await qc.invalidateQueries({ queryKey: ["admin-articles"] });
      setRemoving(null);
      setNote("");
      toast.success("Artigo retirado do blog.");
    } catch (e) {
      toast.error(blogError(e));
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
        Nenhum artigo no ar ainda.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="block-card space-y-2 p-4">
          <p className="font-bold">{r.title}</p>
          <p className="text-sm text-muted-foreground">
            {r.author_name} · {formatDate(r.published_at)}
            {r.adjusted ? " · com ajustes da equipe" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/blog/$slug" params={{ slug: r.slug }}>
                <ExternalLink /> Ver
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRemoving(removing === r.id ? null : r.id)}
            >
              Tirar do ar
            </Button>
          </div>
          {removing === r.id && (
            <div className="space-y-2">
              <Textarea
                value={note}
                maxLength={1000}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo (o autor vai ler)"
              />
              <Button type="button" size="sm" variant="destructive" onClick={() => remove(r.id)}>
                Tirar do ar e avisar o autor
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
