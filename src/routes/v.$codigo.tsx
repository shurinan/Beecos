import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/ShareButton";
import { useAuth } from "@/lib/auth";
import { rememberDestination } from "@/lib/after-login";
import { photoUrl, sortPhotos } from "@/lib/post-photos";
import { postPreview } from "@/lib/share";
import { jsonLdString, postCanonical, postJsonLd, postRobots, type SeoPost } from "@/lib/seo";
import { postParams } from "@/lib/urls";

/** Link público de uma vaga ou anúncio (beecos.com.br/v/codigo), feito para compartilhar. */
export const Route = createFileRoute("/v/$codigo")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    try {
      const { data } = await supabase
        .from("posts")
        .select("*, professions(name, slug), services(name), post_photos(id, path, sort)")
        .eq("slug", params.codigo)
        .maybeSingle();
      return { post: (data as unknown as PostWithAuthor | null) ?? null };
    } catch {
      return { post: null };
    }
  },
  head: ({ loaderData, params }) => {
    const post = loaderData?.post;
    const { title, description } = post
      ? postPreview(post)
      : { title: "Vaga no Beecos", description: "Vagas de serviço perto de você." };
    const first = post ? sortPhotos(post.post_photos)[0] : undefined;
    const image = first ? photoUrl(first.path) : null;
    const seoPost = post as unknown as SeoPost | null;
    const robots = postRobots(seoPost);
    const jsonLd = postJsonLd(seoPost);
    const canonical = postCanonical(post?.slug || params.codigo);
    return {
      links: [{ rel: "canonical", href: canonical }],
      scripts: jsonLd ? [{ type: "application/ld+json", children: jsonLdString(jsonLd) }] : [],
      meta: [
        ...(robots ? [{ name: "robots", content: robots }] : []),
        { title: `${title} — Beecos` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "article" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:alt", content: title },
              { name: "twitter:image", content: image },
            ]
          : []),
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: SharedPost,
});

function SharedPost() {
  const { post } = Route.useLoaderData();
  const { userId, ready } = useAuth();
  const navigate = useNavigate();
  const full = post?.slug
    ? postParams({ slug: post.slug, professions: post.professions ?? null })
    : null;

  // quem já tem conta vai direto para a página completa da vaga
  useEffect(() => {
    if (ready && userId && full) {
      void navigate({ to: "/vagas/$profissao/$codigo", params: full, replace: true });
    }
  }, [ready, userId, full, navigate]);

  if (!post) {
    return (
      <div className="block-card mx-auto mt-4 max-w-md space-y-3 p-6 text-center">
        <h1 className="text-2xl">Esta publicação não existe mais</h1>
        <p className="text-sm text-muted-foreground">Veja as outras vagas perto de você.</p>
        <Button asChild>
          <Link to="/vagas" search={{ q: undefined, tipo: "vagas" }}>
            Ver vagas
          </Link>
        </Button>
      </div>
    );
  }

  const dates = post as { closed_at?: string | null; expires_at?: string | null };
  const closed =
    !!dates.closed_at || (!!dates.expires_at && new Date(dates.expires_at).getTime() < Date.now());

  function enter() {
    if (full) rememberDestination(`/vagas/${full.profissao}/${full.codigo}`);
    void navigate({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PostCard post={post} full />
      {closed ? (
        <div className="block-card space-y-3 p-4 text-center">
          <p className="font-semibold">
            {post.kind === "job" ? "Esta vaga já foi encerrada." : "Este anúncio já foi encerrado."}
          </p>
          <Button asChild variant="outline">
            <Link to="/vagas" search={{ q: undefined, tipo: "vagas" }}>
              Ver outras vagas
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button size="lg" className="w-full" onClick={enter}>
            <MessageCircle /> {post.kind === "job" ? "Tenho interesse" : "Conversar e negociar"}
          </Button>
          <ShareButton post={post} mine={false} />
          <p className="text-center text-xs text-muted-foreground">
            Para conversar, entre ou crie a sua conta grátis. Você volta direto para esta{" "}
            {post.kind === "job" ? "vaga" : "publicação"}.
          </p>
        </div>
      )}
    </div>
  );
}
