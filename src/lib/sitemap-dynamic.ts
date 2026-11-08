import type { SitemapEntry } from "@/lib/sitemap";
import { citySlug } from "@/lib/location";
import { isPostOpen } from "@/lib/seo";

/** Quantas publicações abertas (as mais recentes) entram no sitemap. */
export const SITEMAP_POST_LIMIT = 5000;

export type SitemapPostRow = {
  slug: string | null;
  city: string | null;
  /** Data da última mudança do post. Hoje é a data de publicação (o post não guarda edição). */
  created_at: string;
  expires_at?: string | null;
  closed_at?: string | null;
  hidden_at?: string | null;
  professions?: { slug?: string | null } | null;
};

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function later(a: string | undefined, b: string): string {
  return !a || new Date(b).getTime() > new Date(a).getTime() ? b : a;
}

/**
 * URLs dinâmicas: /v/slug de cada publicação aberta (da mais nova para a mais antiga, até 5000)
 * e as páginas /servicos/profissao e /servicos/profissao/cidade que têm ao menos 1 publicação aberta.
 */
export function postSitemapEntries(rows: SitemapPostRow[], now = Date.now()): SitemapEntry[] {
  const open = rows
    .filter((r) => r.slug && SAFE_SLUG.test(r.slug) && isPostOpen(r, now))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, SITEMAP_POST_LIMIT);

  const posts: SitemapEntry[] = open.map((r) => ({ path: `/v/${r.slug}`, lastmod: r.created_at }));

  const professions = new Map<string, string>();
  const cities = new Map<string, string>();
  for (const r of open) {
    const prof = r.professions?.slug;
    if (!prof || !SAFE_SLUG.test(prof)) continue;
    const profPath = `/servicos/${prof}`;
    professions.set(profPath, later(professions.get(profPath), r.created_at));
    const city = citySlug(r.city);
    if (!city) continue;
    const cityPath = `${profPath}/${city}`;
    cities.set(cityPath, later(cities.get(cityPath), r.created_at));
  }
  const pages = [...professions, ...cities]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, lastmod]) => ({ path, lastmod }));

  return [...posts, ...pages];
}

/** Se a leitura falhar, o sitemap sai só com as rotas estáticas. */
export async function loadDynamicSitemapEntries(
  load: () => Promise<SitemapPostRow[]>,
  now = Date.now(),
): Promise<SitemapEntry[]> {
  try {
    return postSitemapEntries(await load(), now);
  } catch {
    return [];
  }
}
