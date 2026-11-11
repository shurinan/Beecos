import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ArticleView } from "@/components/blog/ArticleView";
import { Button } from "@/components/ui/button";
import { articleUrl, blogImageUrl, fetchArticle } from "@/lib/blog";
import { SITE_URL } from "@/lib/urls";

/** Página de um artigo do blog: pública, com prévia no WhatsApp e no Google. */
export const Route = createFileRoute("/blog/$slug")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    try {
      return { article: await fetchArticle(params.slug) };
    } catch {
      return { article: null };
    }
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article;
    if (!a) {
      return {
        meta: [{ title: "Artigo não encontrado — Beecos" }, { name: "robots", content: "noindex" }],
      };
    }
    const url = articleUrl(params.slug);
    const image = a.cover_path ? blogImageUrl(a.cover_path) : null;
    const ld = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.excerpt,
      datePublished: a.published_at,
      dateModified: a.updated_at ?? a.published_at,
      mainEntityOfPage: url,
      author: { "@type": "Person", name: a.author.name },
      publisher: { "@type": "Organization", name: "Beecos", url: SITE_URL },
      ...(image ? { image: [image] } : {}),
    };
    return {
      meta: [
        { title: `${a.title} — Blog do Beecos` },
        { name: "description", content: a.excerpt },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.excerpt },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: a.published_at },
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:alt", content: a.title },
              { name: "twitter:image", content: image },
            ]
          : []),
        { name: "twitter:title", content: a.title },
        { name: "twitter:description", content: a.excerpt },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          // "<" escapado: o texto do autor não fecha a tag do script
          children: JSON.stringify(ld).replace(/</g, "\\u003c"),
        },
      ],
    };
  },
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();

  if (!article) {
    return (
      <div className="block-card mx-auto mt-4 max-w-md space-y-3 p-6 text-center">
        <h1 className="text-2xl">Este artigo não existe mais</h1>
        <p className="text-sm text-muted-foreground">Veja os outros artigos do blog.</p>
        <Button asChild>
          <Link to="/blog" search={{ assunto: undefined }}>
            Ir para o blog
          </Link>
        </Button>
      </div>
    );
  }

  const url = articleUrl(article.slug);
  const text = `${article.title} — no blog do Beecos: ${url}`;

  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: article!.title, text, url });
        return;
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado. É só colar onde quiser.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/blog"
        search={{ assunto: undefined }}
        className="inline-flex items-center gap-1 text-sm font-bold underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Blog do Beecos
      </Link>

      <ArticleView article={article} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={share}>
          <Share2 /> Compartilhar
        </Button>
        <Button
          asChild
          variant="outline"
          className="bg-[#25D366] text-[#0b2b16] hover:bg-[#1fbe5b]"
        >
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle /> WhatsApp
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Link copiado.");
            } catch {
              toast.error("Não foi possível copiar o link.");
            }
          }}
        >
          <Copy /> Copiar link
        </Button>
      </div>

      <div className="block-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          <span className="block font-bold">Você também sabe ensinar algo?</span>
          Profissionais Premium escrevem no blog e aparecem para quem procura.
        </p>
        <Button asChild size="sm">
          <Link to="/meus-artigos">Escrever um artigo</Link>
        </Button>
      </div>
    </div>
  );
}
