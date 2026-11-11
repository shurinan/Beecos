import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, PenLine, Send } from "lucide-react";
import { toast } from "sonner";
import { ArticleView } from "@/components/blog/ArticleView";
import { Button } from "@/components/ui/button";
import { useIsModerator } from "@/lib/admin";
import {
  type Author,
  blogError,
  type Draft,
  reviewArticle,
  saveDraft,
  submitArticle,
  useMeAsAuthor,
  useMyArticle,
  withdrawArticle,
} from "@/lib/blog";
import { readingMinutes } from "@/lib/blog-html";
import { confirmAction } from "@/lib/confirm";

// o editor é pesado: só carrega nesta tela
const ArticleEditor = lazy(() => import("@/components/blog/ArticleEditor"));

export const Route = createFileRoute("/_authenticated/escrever/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Escrever artigo — Beecos" }] }),
  component: WritePage,
});

type Save = "idle" | "saving" | "saved" | "error";

function WritePage() {
  const { id } = Route.useParams();
  // outro artigo: começa do zero (rascunho, editor e salvamento)
  return <Writer key={id} id={id} />;
}

function Writer({ id }: { id: string }) {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: article, isLoading, isError, refetch } = useMyArticle(id, userId);
  const { data: me } = useMeAsAuthor(userId);
  const { data: isMod } = useIsModerator();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [save, setSave] = useState<Save>("idle");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const latest = useRef<Draft | null>(null);
  latest.current = draft;

  // primeira carga: o rascunho vira o estado local do editor
  useEffect(() => {
    if (article && !draft) setDraft(article.draft);
  }, [article, draft]);

  // salva sozinho, 1,2 s depois da última mudança
  useEffect(() => {
    if (!draft || !dirty.current) return;
    setSave("saving");
    const t = window.setTimeout(() => void flush(), 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // saiu da tela com alteração pendente: grava assim mesmo
  useEffect(
    () => () => {
      if (dirty.current && latest.current) void saveDraft(id, latest.current).catch(() => {});
    },
    [id],
  );

  async function flush(): Promise<boolean> {
    const d = latest.current;
    if (!d || !dirty.current) return true;
    dirty.current = false;
    try {
      await saveDraft(id, d);
      setSave("saved");
      return true;
    } catch (e) {
      dirty.current = true;
      setSave("error");
      toast.error(blogError(e));
      return false;
    }
  }

  function change(d: Draft) {
    dirty.current = true;
    setDraft(d);
  }

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["my-article", id] }),
      qc.invalidateQueries({ queryKey: ["my-articles", userId] }),
    ]);
  }

  async function send() {
    if (!(await flush())) return;
    setBusy(true);
    try {
      await submitArticle(id);
      await refresh();
      toast.success("Enviado! A equipe vai revisar e você recebe um aviso.");
      await navigate({ to: "/meus-artigos" });
    } catch (e) {
      toast.error(blogError(e));
    } finally {
      setBusy(false);
    }
  }

  async function publishNow() {
    const ok = await confirmAction({
      title: "Tem certeza que deseja publicar agora?",
      description: "Como você é da equipe, o artigo vai direto para o blog.",
      confirmLabel: "Publicar",
      danger: false,
    });
    if (!ok || !(await flush())) return;
    setBusy(true);
    try {
      await submitArticle(id);
      const slug = await reviewArticle(id, "approve");
      await refresh();
      toast.success("Publicado no blog!");
      if (slug) await navigate({ to: "/blog/$slug", params: { slug } });
    } catch (e) {
      toast.error(blogError(e));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    const ok = await confirmAction({
      title: "Tem certeza que deseja retirar da análise?",
      description: "O artigo sai da fila da equipe. Depois de editar, envie de novo.",
      confirmLabel: "Retirar da análise",
      danger: false,
    });
    if (!ok) return;
    try {
      await withdrawArticle(id);
      await refresh();
    } catch (e) {
      toast.error(blogError(e));
    }
  }

  if (isLoading || (article && !draft)) {
    return <p className="py-10 text-center text-muted-foreground">Carregando…</p>;
  }
  if (isError) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível abrir o artigo.</p>
        <Button onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }
  if (!article || !draft) {
    return (
      <div className="block-card mx-auto max-w-md space-y-3 p-6 text-center">
        <h1 className="text-2xl">Artigo não encontrado</h1>
        <Button asChild>
          <Link to="/meus-artigos">Meus artigos</Link>
        </Button>
      </div>
    );
  }

  const pending = article.review === "pending";
  const author: Author = me ?? {
    id: userId,
    name: "Você",
    username: null,
    avatar_path: null,
    headline: "",
    city: "",
    verified: false,
    team: false,
  };
  const view = {
    title: draft.title,
    topic: draft.topic,
    cover_path: draft.cover_path,
    body_html: draft.body_html,
    reading_min: readingMinutes(draft.body_html),
    signature: draft.signature,
    author,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/meus-artigos"
          className="inline-flex items-center gap-1 text-sm font-bold underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Meus artigos
        </Link>
        {!pending && (
          <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
            {save === "saving"
              ? "Salvando…"
              : save === "saved"
                ? "Rascunho salvo"
                : save === "error"
                  ? "Não salvou. Vamos tentar de novo."
                  : "O rascunho é salvo sozinho"}
          </span>
        )}
      </div>

      {pending && (
        <div className="block-card space-y-2 bg-[oklch(0.9_0.05_255)] p-4 text-[oklch(0.25_0.08_255)]">
          <p className="font-bold">Em análise pela equipe</p>
          <p className="text-sm">
            Você recebe um aviso quando for publicado ou se precisar de correção. Para mexer no
            texto agora, retire da análise.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={withdraw}>
            Retirar da análise para editar
          </Button>
        </div>
      )}
      {article.review === "rejected" && article.review_note && (
        <div className="block-card space-y-1 bg-[oklch(0.93_0.06_25)] p-4 text-[oklch(0.3_0.1_25)]">
          <p className="font-bold">A equipe pediu correções</p>
          <p className="selectable text-sm">{article.review_note}</p>
          <p className="text-xs">Corrija e envie de novo.</p>
        </div>
      )}
      {article.status === "published" && !pending && (
        <p className="rounded-lg border-2 border-foreground/30 p-3 text-sm">
          Este artigo está no ar. Se você mudar algo, a nova versão passa pela equipe; a atual
          continua no blog até ser aprovada.
        </p>
      )}

      {!pending && (
        <div className="flex overflow-hidden rounded-xl border-2 border-foreground bg-card">
          {(
            [
              { on: !preview, label: "Escrever", icon: PenLine, set: false },
              { on: preview, label: "Prévia", icon: Eye, set: true },
            ] as const
          ).map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={t.on}
              onClick={() => setPreview(t.set)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 font-bold ${t.on ? "bg-foreground text-primary dark:text-background" : ""}`}
            >
              <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {pending || preview ? (
        <div className="block-card p-4 sm:p-6">
          <ArticleView article={view} preview />
        </div>
      ) : (
        <Suspense
          fallback={<p className="py-10 text-center text-muted-foreground">Abrindo o editor…</p>}
        >
          <ArticleEditor value={draft} onChange={change} userId={userId} />
        </Suspense>
      )}

      {!pending && (
        <div className="sticky bottom-20 z-10 flex flex-wrap justify-end gap-2 rounded-xl border-2 border-foreground bg-card p-2 shadow-block lg:bottom-4">
          {isMod && (
            <Button type="button" variant="outline" onClick={publishNow} disabled={busy}>
              Publicar agora
            </Button>
          )}
          <Button type="button" onClick={send} disabled={busy}>
            <Send /> Enviar para revisão
          </Button>
        </div>
      )}
    </div>
  );
}
