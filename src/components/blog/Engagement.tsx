import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/profile-bits";
import { Button } from "@/components/ui/button";
import { useIsModerator } from "@/lib/admin";
import { rememberDestination } from "@/lib/after-login";
import { useAuth } from "@/lib/auth";
import {
  addComment,
  type ArticleComment,
  blogError,
  deleteComment,
  recordView,
  toggleLike,
  useArticleComments,
  useArticleStats,
} from "@/lib/blog";
import { confirmAction } from "@/lib/confirm";
import { profileParam } from "@/lib/urls";

const MAX = 1000;

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Visualizações, curtir e comentários do artigo. Conta a visita uma vez por pessoa (menos o autor). */
export function Engagement({
  slug,
  articleId,
  authorId,
}: {
  slug: string;
  articleId: string;
  authorId: string;
}) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const stats = useArticleStats(slug, userId);
  const comments = useArticleComments(slug, userId);
  const { data: isMod } = useIsModerator();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void recordView(slug).then(() => qc.invalidateQueries({ queryKey: ["article-stats", slug] }));
    // só na abertura do artigo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function needLogin() {
    rememberDestination(`/blog/${slug}`);
    toast("Entre na sua conta para continuar.");
    void navigate({ to: "/auth" });
  }

  async function like() {
    if (!userId) return needLogin();
    try {
      await toggleLike(articleId);
      await qc.invalidateQueries({ queryKey: ["article-stats", slug] });
    } catch (e) {
      toast.error(blogError(e));
    }
  }

  async function send() {
    if (!userId) return needLogin();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await addComment(articleId, body);
      setText("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["article-comments", slug] }),
        qc.invalidateQueries({ queryKey: ["article-stats", slug] }),
      ]);
    } catch (e) {
      toast.error(blogError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: ArticleComment) {
    const ok = await confirmAction({
      title: "Tem certeza que deseja apagar este comentário?",
      description: "Ele some do artigo e não dá para desfazer.",
      confirmLabel: "Apagar comentário",
    });
    if (!ok) return;
    try {
      await deleteComment(c.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["article-comments", slug] }),
        qc.invalidateQueries({ queryKey: ["article-stats", slug] }),
      ]);
    } catch (e) {
      toast.error(blogError(e));
    }
  }

  const s = stats.data;
  const liked = !!s?.liked;

  return (
    <section aria-label="Interação" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={like}
          aria-pressed={liked}
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-foreground px-4 py-2 font-bold shadow-block transition-transform active:translate-x-0.5 active:translate-y-0.5 ${liked ? "bg-primary text-primary-foreground" : "bg-card"}`}
        >
          <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} aria-hidden="true" />
          {liked ? "Curtiu" : "Curtir"} · {s?.likes ?? 0}
        </button>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> {s?.comments ?? 0}{" "}
          {(s?.comments ?? 0) === 1 ? "comentário" : "comentários"}
        </span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" aria-hidden="true" /> {s?.views ?? 0}{" "}
          {(s?.views ?? 0) === 1 ? "visualização" : "visualizações"}
        </span>
      </div>

      <div className="block-card space-y-3 p-4">
        <h2 className="text-xl">Comentários</h2>
        {userId ? (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              rows={3}
              placeholder="Escreva um comentário com respeito."
              aria-label="Seu comentário"
              className="w-full rounded-xl border-2 border-foreground bg-background p-3 text-base"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {text.length}/{MAX}
              </span>
              <Button type="button" onClick={send} disabled={busy || !text.trim()}>
                <Send /> Comentar
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-foreground/40 p-3 text-center text-sm">
            <p className="mb-2 font-semibold">Entre para curtir e comentar.</p>
            <Button type="button" size="sm" onClick={needLogin}>
              Entrar
            </Button>
          </div>
        )}

        {comments.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {comments.isError && (
          <p className="text-sm font-semibold">
            Não foi possível carregar os comentários.{" "}
            <button type="button" className="underline" onClick={() => comments.refetch()}>
              Tentar de novo
            </button>
          </p>
        )}
        {comments.data && comments.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Ninguém comentou ainda. Seja o primeiro.</p>
        )}
        <ul className="space-y-3">
          {comments.data?.map((c) => {
            const slugP = profileParam({ id: c.author.id, slug: c.author.username });
            const canDelete = !!c.mine || userId === authorId || !!isMod;
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar name={c.author.name} path={c.author.avatar_path} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {userId ? (
                      <Link
                        to="/perfil/$slug"
                        params={{ slug: slugP }}
                        search={{ post: undefined }}
                        className="font-bold hover:underline"
                      >
                        {c.author.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{c.author.name}</span>
                    )}{" "}
                    <span className="text-xs text-muted-foreground">· {ago(c.created_at)}</span>
                  </p>
                  <p className="selectable whitespace-pre-wrap break-words">{c.body}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label="Apagar comentário"
                    className="h-fit rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
