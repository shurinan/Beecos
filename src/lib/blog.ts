import type { SupabaseClient } from "@supabase/supabase-js";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cleanArticleHtml } from "@/lib/blog-html";
import { TOPICS } from "@/lib/discovery";
import { shrinkPhoto } from "@/lib/post-photos";
import { SITE_URL } from "@/lib/urls";

/**
 * Blog do Beecos. Escrever é do Premium (e da equipe); tudo passa pela aprovação da equipe.
 * O autor mexe só no rascunho; a versão no ar muda quando a equipe publica.
 */

// as tabelas do blog ainda não estão nos tipos gerados do banco
const db = supabase as unknown as SupabaseClient;

export const BLOG_BUCKET = "blog";

/** Assuntos do blog: os mesmos do início, mais dicas gerais. */
export const BLOG_TOPICS: string[] = [
  ...TOPICS.map((t) => t.label),
  "Dicas para profissionais",
  "Para quem contrata",
];

export type Draft = {
  title: string;
  excerpt: string;
  body_html: string;
  cover_path: string | null;
  topic: string | null;
  signature: boolean;
};

export const EMPTY_DRAFT: Draft = {
  title: "",
  excerpt: "",
  body_html: "",
  cover_path: null,
  topic: null,
  signature: true,
};

export function toDraft(raw: unknown): Draft {
  const r = (raw ?? {}) as Partial<Record<keyof Draft, unknown>>;
  return {
    title: typeof r.title === "string" ? r.title : "",
    excerpt: typeof r.excerpt === "string" ? r.excerpt : "",
    body_html: typeof r.body_html === "string" ? r.body_html : "",
    cover_path: typeof r.cover_path === "string" && r.cover_path ? r.cover_path : null,
    topic: typeof r.topic === "string" && r.topic ? r.topic : null,
    signature: r.signature !== false,
  };
}

export type Author = {
  id: string;
  name: string;
  username: string | null;
  avatar_path: string | null;
  headline: string;
  city: string;
  verified: boolean;
  team: boolean;
};

export type ArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_path: string | null;
  topic: string | null;
  published_at: string;
  reading_min: number;
  author: Author;
};

export type Article = ArticleCard & {
  body_html: string;
  signature: boolean;
  updated_at: string | null;
};

export type Review = "draft" | "pending" | "rejected" | "approved";
export type LiveStatus = "none" | "published" | "removed";

export type MyArticle = {
  id: string;
  draft: Draft;
  review: Review;
  review_note: string | null;
  status: LiveStatus;
  slug: string | null;
  title: string;
  adjusted: boolean;
  removed_note: string | null;
  published_at: string | null;
  submitted_at: string | null;
  updated_at: string;
};

// ── endereços ─────────────────────────────────────────────────────────────────────────────────

/** Começo das URLs das fotos do blog (o filtro de HTML só aceita imagens daqui). */
export function blogImagePrefix(): string {
  return supabase.storage.from(BLOG_BUCKET).getPublicUrl("").data.publicUrl.replace(/\/?$/, "/");
}

export function blogImageUrl(path: string): string {
  return supabase.storage.from(BLOG_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function articleUrl(slug: string): string {
  return `${SITE_URL}/blog/${slug}`;
}

/** HTML do artigo pronto para mostrar (sempre filtrado). */
export function safeArticleHtml(html: string): string {
  return cleanArticleHtml(html, { imagePrefixes: [blogImagePrefix()] });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

// ── leitura pública ───────────────────────────────────────────────────────────────────────────

export const BLOG_PAGE = 12;

export async function fetchBlogList(opts: {
  topic?: string | null | undefined;
  author?: string | null | undefined;
  before?: string | null | undefined;
  limit?: number;
}): Promise<ArticleCard[]> {
  const { data, error } = await db.rpc("blog_list", {
    _topic: opts.topic ?? null,
    _author: opts.author ?? null,
    _before: opts.before ?? null,
    _limit: opts.limit ?? BLOG_PAGE,
  });
  if (error) throw error;
  return (data ?? []) as ArticleCard[];
}

export async function fetchArticle(slug: string): Promise<Article | null> {
  const { data, error } = await db.rpc("blog_article", { _slug: slug });
  if (error) throw error;
  return (data as Article | null) ?? null;
}

export function useBlogList(topic: string | null, initial: ArticleCard[] | undefined) {
  return useInfiniteQuery({
    queryKey: ["blog", topic],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchBlogList({ topic, before: pageParam }),
    getNextPageParam: (last) =>
      last.length < BLOG_PAGE ? undefined : last[last.length - 1]?.published_at,
    ...(initial ? { initialData: { pages: [initial], pageParams: [null] } } : {}),
  });
}

export function useAuthorArticles(authorId: string | undefined) {
  return useQuery({
    queryKey: ["blog-author", authorId],
    enabled: !!authorId,
    queryFn: () => fetchBlogList({ author: authorId!, limit: 50 }),
  });
}

// ── autor ─────────────────────────────────────────────────────────────────────────────────────

export function useCanWriteBlog(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["can-write-blog", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db.rpc("can_write_blog", { _uid: userId });
      if (error) throw error;
      return !!data;
    },
  });
}

const MY_COLS =
  "id, draft, review, review_note, status, slug, title, adjusted, removed_note, published_at, submitted_at, updated_at";

export function useMyArticles(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-articles", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyArticle[]> => {
      const { data, error } = await db
        .from("articles")
        .select(MY_COLS)
        .eq("author_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as MyArticle[]).map((a) => ({ ...a, draft: toDraft(a.draft) }));
    },
  });
}

export function useMyArticle(id: string, userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-article", id],
    enabled: !!userId,
    queryFn: async (): Promise<MyArticle | null> => {
      const { data, error } = await db
        .from("articles")
        .select(MY_COLS)
        .eq("id", id)
        .eq("author_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...(data as MyArticle), draft: toDraft((data as MyArticle).draft) } : null;
    },
  });
}

export async function createArticle(): Promise<string> {
  const { data, error } = await db.rpc("create_article");
  if (error) throw error;
  return data as string;
}

/** Grava o rascunho já com o HTML filtrado. */
export async function saveDraft(id: string, draft: Draft) {
  const clean: Draft = {
    ...draft,
    title: draft.title.slice(0, 140),
    excerpt: draft.excerpt.slice(0, 300),
    body_html: safeArticleHtml(draft.body_html),
  };
  const { error } = await db.from("articles").update({ draft: clean }).eq("id", id);
  if (error) throw error;
}

export async function submitArticle(id: string) {
  const { error } = await db.rpc("submit_article", { _id: id });
  if (error) throw error;
}

export async function withdrawArticle(id: string) {
  const { error } = await db.rpc("withdraw_article", { _id: id });
  if (error) throw error;
}

export async function deleteArticle(id: string) {
  const { error } = await db.from("articles").delete().eq("id", id);
  if (error) throw error;
}

/** Envia uma foto (reduzida para no máximo 1600 px) e devolve o caminho e o endereço público. */
export async function uploadBlogImage(userId: string, file: File) {
  const blob = await shrinkPhoto(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from(BLOG_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  return { path, url: blogImageUrl(path) };
}

/** Quem escreve, como aparece na prévia. */
export function useMeAsAuthor(userId: string) {
  return useQuery({
    queryKey: ["me-author", userId],
    queryFn: async (): Promise<Author> => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, slug, avatar_path, headline, city")
        .eq("id", userId)
        .maybeSingle();
      return {
        id: userId,
        name: data?.full_name || "Você",
        username: data?.slug ?? null,
        avatar_path: data?.avatar_path ?? null,
        headline: data?.headline ?? "",
        city: data?.city ?? "",
        verified: false,
        team: false,
      };
    },
  });
}

// ── equipe ────────────────────────────────────────────────────────────────────────────────────

export type PendingArticle = {
  id: string;
  author_id: string;
  draft: Draft;
  submitted_at: string;
  status: LiveStatus;
  slug: string | null;
  live_title: string;
  author_name: string;
  author_username: string | null;
  author_avatar: string | null;
  team: boolean;
  author: Author;
};
export type LiveArticleRow = {
  id: string;
  slug: string;
  title: string;
  published_at: string;
  adjusted: boolean;
  author_name: string;
};

export function useAdminArticles(enabled = true) {
  return useQuery({
    queryKey: ["admin-articles"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_articles");
      if (error) throw error;
      const d = data as { pending: PendingArticle[]; published: LiveArticleRow[] };
      return {
        pending: d.pending.map((p) => ({ ...p, draft: toDraft(p.draft) })),
        published: d.published,
      };
    },
  });
}

export async function reviewArticle(
  id: string,
  decision: "approve" | "adjust" | "reject",
  note?: string,
  draft?: Draft,
) {
  const { data, error } = await db.rpc("review_article", {
    _id: id,
    _decision: decision,
    _note: note ?? null,
    _draft: draft ? { ...draft, body_html: safeArticleHtml(draft.body_html) } : null,
  });
  if (error) throw error;
  return data as string | null;
}

export async function removeArticle(id: string, note: string) {
  const { error } = await db.rpc("remove_article", { _id: id, _note: note });
  if (error) throw error;
}

// ── mensagens ─────────────────────────────────────────────────────────────────────────────────

const ERRORS: Record<string, string> = {
  SO_PREMIUM: "Escrever no blog é do plano Premium.",
  LIMITE_DIA: "Você chegou ao limite de hoje. Tente de novo amanhã.",
  MUITOS_RASCUNHOS: "Você já tem 10 rascunhos. Termine ou apague algum antes de começar outro.",
  TITULO_CURTO: "Escreva um título (pelo menos 5 letras).",
  TEXTO_CURTO: "O artigo está curto. Escreva pelo menos uns 3 parágrafos (300 letras).",
  NADA_NOVO: "Não há mudanças para enviar: o artigo no ar já é esta versão.",
  MOTIVO_OBRIGATORIO: "Escreva o motivo: o autor vai ler.",
  FORA_DA_FILA: "Este artigo não está mais na fila (outra pessoa já revisou ou o autor retirou).",
  NAO_ENCONTRADO: "Artigo não encontrado.",
};

export function blogError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key]! : "Não foi possível concluir. Tente de novo.";
}

/** Situação do artigo para o autor, em português. */
export function articleState(a: Pick<MyArticle, "review" | "status" | "adjusted">): {
  label: string;
  tone: "yellow" | "green" | "blue" | "gray" | "red";
}[] {
  const out: { label: string; tone: "yellow" | "green" | "blue" | "gray" | "red" }[] = [];
  if (a.status === "published") {
    out.push({ label: a.adjusted ? "No ar · com ajustes da equipe" : "No ar", tone: "green" });
  }
  if (a.status === "removed") out.push({ label: "Retirado pela equipe", tone: "red" });
  if (a.review === "pending") out.push({ label: "Em análise", tone: "blue" });
  else if (a.review === "rejected") out.push({ label: "Precisa de correções", tone: "red" });
  else if (a.review === "draft") {
    out.push({
      label: a.status === "published" ? "Alterações não enviadas" : "Rascunho",
      tone: a.status === "published" ? "yellow" : "gray",
    });
  }
  return out;
}
