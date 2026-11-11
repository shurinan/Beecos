import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsFrame } from "@/components/SettingsFrame";
import { Button } from "@/components/ui/button";
import {
  articleState,
  blogError,
  createArticle,
  deleteArticle,
  type MyArticle,
  useCanWriteBlog,
  useMyArticles,
} from "@/lib/blog";
import { confirmAction } from "@/lib/confirm";

export const Route = createFileRoute("/_authenticated/meus-artigos")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Meus artigos — Beecos" },
      { name: "description", content: "Os artigos que você escreveu para o blog do Beecos." },
    ],
  }),
  component: MyArticlesPage,
});

function MyArticlesPage() {
  return (
    <SettingsFrame>
      <MyArticles />
    </SettingsFrame>
  );
}

const TONE = {
  yellow: "bg-primary text-primary-foreground",
  green: "bg-[oklch(0.9_0.08_150)] text-[oklch(0.25_0.06_150)]",
  blue: "bg-[oklch(0.9_0.05_255)] text-[oklch(0.28_0.08_255)]",
  gray: "bg-muted text-foreground",
  red: "bg-[oklch(0.9_0.07_25)] text-[oklch(0.3_0.1_25)]",
} as const;

function MyArticles() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: canWrite, isLoading: loadingPlan } = useCanWriteBlog(userId);
  const { data, isLoading, isError, refetch } = useMyArticles(userId);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const id = await createArticle();
      await navigate({ to: "/escrever/$id", params: { id } });
    } catch (e) {
      toast.error(blogError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: MyArticle) {
    const live = a.status === "published";
    const ok = await confirmAction({
      title: "Tem certeza que deseja apagar este artigo?",
      description: live
        ? "Ele sai do blog na hora e não dá para desfazer."
        : "O rascunho é apagado e não dá para desfazer.",
      confirmLabel: "Apagar artigo",
    });
    if (!ok) return;
    try {
      await deleteArticle(a.id);
      await qc.invalidateQueries({ queryKey: ["my-articles", userId] });
      toast.success("Artigo apagado.");
    } catch (e) {
      toast.error(blogError(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Meus artigos</h1>
        {canWrite && (
          <Button type="button" onClick={start} disabled={busy}>
            <Plus /> Escrever artigo
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Tudo o que você escreve passa pela equipe do Beecos antes de ir para o{" "}
        <Link to="/blog" search={{ assunto: undefined }} className="font-bold underline">
          blog
        </Link>
        . Se precisar de correção, você recebe um aviso com o que mudar.
      </p>

      {!loadingPlan && !canWrite && (
        <div className="block-card space-y-2 bg-accent p-4">
          <p className="font-display text-lg">Escrever no blog é do Premium</p>
          <p className="text-sm">
            Conte o que você sabe, mostre o seu trabalho e assine o artigo com o seu perfil: quem lê
            pode chamar você direto no Beecos.
          </p>
          <Button asChild size="sm">
            <Link to="/plano">Ver o Premium</Link>
          </Button>
        </div>
      )}

      {isLoading && <p className="py-6 text-center text-muted-foreground">Carregando…</p>}
      {isError && (
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Não foi possível carregar os seus artigos.</p>
          <Button onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      )}
      {data && data.length === 0 && canWrite && (
        <div className="rounded-xl border-2 border-dashed border-foreground/40 p-6 text-center">
          <p className="font-semibold">Você ainda não escreveu nenhum artigo.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ideias: um erro comum que você vê no seu trabalho, como escolher um bom profissional,
            quanto custa um serviço e por quê.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {data?.map((a) => {
          const title = a.draft.title || a.title || "Sem título";
          const note =
            a.review === "rejected"
              ? { label: "O que a equipe pediu para corrigir", text: a.review_note }
              : a.status === "removed"
                ? { label: "Motivo", text: a.removed_note }
                : a.adjusted && a.review === "approved" && a.review_note
                  ? { label: "Ajustes da equipe", text: a.review_note }
                  : null;
          return (
            <li key={a.id} className="block-card space-y-2 p-4">
              <p className="font-bold leading-snug">{title}</p>
              <div className="flex flex-wrap gap-1">
                {articleState(a).map((s) => (
                  <span
                    key={s.label}
                    className={`rounded-full border-[1.5px] border-foreground px-2 py-px text-xs font-bold ${TONE[s.tone]}`}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
              {note?.text && (
                <div className="rounded-lg border-2 border-foreground/30 bg-muted/50 p-3 text-sm">
                  <span className="block font-bold">{note.label}</span>
                  <span className="selectable">{note.text}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link to="/escrever/$id" params={{ id: a.id }}>
                    <Pencil /> {a.review === "pending" ? "Abrir" : "Editar"}
                  </Link>
                </Button>
                {a.status === "published" && a.slug && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/blog/$slug" params={{ slug: a.slug }}>
                      <ExternalLink /> Ver no blog
                    </Link>
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => remove(a)}>
                  <Trash2 /> Apagar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
