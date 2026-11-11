import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Clock, MapPin, MessageCircle, UserRound } from "lucide-react";
import { Avatar } from "@/components/profile-bits";
import { UserSeal } from "@/components/Seal";
import { Button } from "@/components/ui/button";
import { rememberDestination } from "@/lib/after-login";
import { useAuth } from "@/lib/auth";
import { type Author, blogImageUrl, formatDate, safeArticleHtml } from "@/lib/blog";
import { publicCity } from "@/lib/location";
import { profileParam } from "@/lib/urls";

export type ViewArticle = {
  title: string;
  topic: string | null;
  cover_path: string | null;
  body_html: string;
  published_at?: string | null;
  reading_min: number;
  signature: boolean;
  author: Author;
};

/** O artigo como o leitor vê: no blog, na prévia do autor e na revisão da equipe. */
export function ArticleView({
  article,
  preview = false,
}: {
  article: ViewArticle;
  preview?: boolean;
}) {
  const html = useMemo(() => safeArticleHtml(article.body_html), [article.body_html]);
  const a = article.author;
  return (
    <article className="space-y-5">
      <header className="space-y-3">
        {article.topic && (
          <span className="inline-block rounded-full border-2 border-foreground bg-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">
            {article.topic}
          </span>
        )}
        <h1 className="text-3xl leading-tight sm:text-4xl">{article.title || "Sem título"}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <Avatar name={a.name} path={a.avatar_path} size={28} />
            {a.team && !article.signature ? "Equipe Beecos" : a.name}
            <UserSeal userId={a.id} size={16} />
          </span>
          {article.published_at && <span>{formatDate(article.published_at)}</span>}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {article.reading_min} min de
            leitura
          </span>
          {preview && (
            <span className="rounded-full border-2 border-foreground px-2 text-xs font-bold">
              Prévia
            </span>
          )}
        </div>
      </header>

      {article.cover_path && (
        <img
          src={blogImageUrl(article.cover_path)}
          alt=""
          className="aspect-[16/9] w-full rounded-xl border-2 border-foreground object-cover"
        />
      )}

      {/* o HTML passou pelo filtro do blog: só formatação segura */}
      <div className="artigo-corpo selectable" dangerouslySetInnerHTML={{ __html: html }} />

      {article.signature && <Signature author={a} preview={preview} />}
    </article>
  );
}

/** Assinatura no fim do artigo: o perfil profissional de quem escreveu. */
function Signature({ author, preview }: { author: Author; preview: boolean }) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const slug = profileParam({ id: author.id, slug: author.username });
  const city = publicCity(author.city);
  const mine = userId === author.id;

  function go(path: "/perfil/$slug" | "/conversas/$slug") {
    if (preview) return;
    if (!userId) {
      rememberDestination(path.replace("$slug", slug));
      void navigate({ to: "/auth" });
      return;
    }
    if (path === "/perfil/$slug") {
      void navigate({ to: path, params: { slug }, search: { post: undefined } });
    } else {
      void navigate({ to: path, params: { slug } });
    }
  }

  return (
    <aside aria-label="Sobre o autor" className="block-card space-y-3 bg-accent p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Sobre o autor
      </p>
      <div className="flex items-center gap-3">
        <Avatar name={author.name} path={author.avatar_path} size={64} userId={author.id} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-lg leading-tight">
            <span className="truncate">{author.name}</span>
            <UserSeal userId={author.id} size={18} />
          </p>
          {author.headline && <p className="font-semibold">{author.headline}</p>}
          {city && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {city}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {userId && !preview ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/perfil/$slug" params={{ slug }} search={{ post: undefined }}>
              <UserRound /> Ver perfil
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => go("/perfil/$slug")}>
            <UserRound /> Ver perfil
          </Button>
        )}
        {!mine && (
          <Button type="button" size="sm" onClick={() => go("/conversas/$slug")}>
            <MessageCircle /> Chamar no Beecos
          </Button>
        )}
      </div>
    </aside>
  );
}

/** Cartão do artigo nas listas (blog, perfil). */
export function ArticleCardView({
  article,
}: {
  article: {
    slug: string;
    title: string;
    excerpt: string;
    cover_path: string | null;
    topic: string | null;
    published_at: string;
    reading_min: number;
    author: Author;
  };
}) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: article.slug }}
      className="block-card flex h-full flex-col overflow-hidden transition-transform active:translate-x-0.5 active:translate-y-0.5"
    >
      {article.cover_path ? (
        <img
          src={blogImageUrl(article.cover_path)}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full border-b-2 border-foreground object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="hazard-stripe block h-3 w-full border-b-2 border-foreground"
        />
      )}
      <span className="flex flex-1 flex-col gap-2 p-4">
        {article.topic && (
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {article.topic}
          </span>
        )}
        <span className="font-display text-lg leading-snug">{article.title}</span>
        {article.excerpt && (
          <span className="line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</span>
        )}
        <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <Avatar name={article.author.name} path={article.author.avatar_path} size={22} />
          <span className="truncate font-semibold text-foreground">
            {article.author.name}
          </span>· {article.reading_min} min
        </span>
      </span>
    </Link>
  );
}
