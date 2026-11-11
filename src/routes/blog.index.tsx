import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Newspaper, PenLine } from "lucide-react";
import { ArticleCardView } from "@/components/blog/ArticleView";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { BLOG_TOPICS, fetchBlogList, useBlogList } from "@/lib/blog";
import { SITE_URL } from "@/lib/urls";

const TITLE = "Blog do Beecos — dicas de quem faz";
const DESCRIPTION =
  "Dicas de profissionais de verdade sobre obras, elétrica, limpeza, beleza e muito mais. E como contratar bem.";

export const Route = createFileRoute("/blog/")({
  staticData: { sitemap: true },
  validateSearch: (q: Record<string, unknown>): { assunto: string | undefined } => ({
    assunto:
      typeof q["assunto"] === "string" && BLOG_TOPICS.includes(q["assunto"])
        ? q["assunto"]
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ assunto: search.assunto }),
  loader: async ({ deps }) => {
    try {
      return { first: await fetchBlogList({ topic: deps.assunto ?? null }) };
    } catch {
      return { first: undefined };
    }
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/blog` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/blog` }],
  }),
  component: Blog,
});

function Blog() {
  const { assunto } = Route.useSearch();
  const { first } = Route.useLoaderData();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const q = useBlogList(assunto ?? null, first);
  const items = q.data?.pages.flat() ?? [];

  const chip = (on: boolean) =>
    `rounded-full border-2 border-foreground px-3 py-1 text-sm font-bold ${on ? "bg-foreground text-primary dark:text-background" : "bg-card hover:bg-foreground/[0.07]"}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-3xl">
            <Newspaper className="h-7 w-7" aria-hidden="true" /> Blog do Beecos
          </h1>
          <p className="text-muted-foreground">
            Dicas de quem faz: profissionais contando o que aprenderam no dia a dia.
          </p>
        </div>
        <Button asChild variant="outline">
          {userId ? (
            <Link to="/meus-artigos">
              <PenLine /> Escrever um artigo
            </Link>
          ) : (
            <Link to="/auth">
              <PenLine /> Escrever um artigo
            </Link>
          )}
        </Button>
      </header>

      <nav aria-label="Assuntos" className="flex flex-wrap gap-2">
        <button
          type="button"
          className={chip(!assunto)}
          onClick={() => void navigate({ to: "/blog", search: { assunto: undefined } })}
        >
          Todos
        </button>
        {BLOG_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className={chip(assunto === t)}
            aria-pressed={assunto === t}
            onClick={() => void navigate({ to: "/blog", search: { assunto: t } })}
          >
            {t}
          </button>
        ))}
      </nav>

      {q.isLoading && <p className="py-8 text-center text-muted-foreground">Carregando…</p>}
      {q.isError && !items.length && (
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Não foi possível carregar o blog.</p>
          <Button onClick={() => q.refetch()}>Tentar de novo</Button>
        </div>
      )}
      {!q.isLoading && !q.isError && items.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-foreground/40 p-8 text-center">
          <p className="font-semibold">
            {assunto ? `Ainda não tem artigos sobre ${assunto}.` : "Ainda não tem artigos aqui."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quer ser o primeiro? Profissionais Premium escrevem no blog e aparecem para quem
            procura.
          </p>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <li key={a.id}>
            <ArticleCardView article={a} />
          </li>
        ))}
      </ul>

      {q.hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
          >
            {q.isFetchingNextPage ? "Carregando…" : "Ver mais artigos"}
          </Button>
        </div>
      )}
    </div>
  );
}
