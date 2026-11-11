import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SITE_URL } from "@/lib/urls";
import { sitemapStaticPaths, sitemapXML, type SitemapEntry } from "@/lib/sitemap";
import {
  loadDynamicSitemapEntries,
  SITEMAP_POST_LIMIT,
  type SitemapPostRow,
} from "@/lib/sitemap-dynamic";

/** Cliente com a chave pública (anon): valem as mesmas regras de acesso do site. */
function publicClient() {
  const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("backend not configured");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // chaves novas (sb_...) não são JWT: vão só no cabeçalho apikey
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Publicações abertas. */
async function loadOpenPosts(): Promise<SitemapPostRow[]> {
  const client = publicClient();
  const { data, error } = await client
    .from("posts")
    .select("slug, city, created_at, expires_at, closed_at, hidden_at, professions(slug)")
    .is("hidden_at", null)
    .is("closed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(SITEMAP_POST_LIMIT);
  if (error) throw error;
  return (data ?? []) as unknown as SitemapPostRow[];
}

/** Artigos do blog no ar (de 50 em 50, até 1000). */
async function loadArticles(): Promise<SitemapEntry[]> {
  const client = publicClient() as unknown as SupabaseClient;
  const out: SitemapEntry[] = [];
  let before: string | null = null;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await client.rpc("blog_list", { _before: before, _limit: 50 });
    if (error) return out;
    const rows = (data ?? []) as { slug: string; published_at: string }[];
    out.push(...rows.map((r) => ({ path: `/blog/${r.slug}`, lastmod: r.published_at })));
    if (rows.length < 50) break;
    before = rows[rows.length - 1]!.published_at;
  }
  return out;
}

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const router = await getRouterInstance();
        const entries: SitemapEntry[] = [
          ...sitemapStaticPaths(router).map((path) => ({ path })),
          ...(await loadDynamicSitemapEntries(loadOpenPosts)),
          ...(await loadArticles().catch(() => [])),
        ];
        if (entries.length === 0) {
          return new Response("No pages are included in this sitemap.", {
            status: 404,
            headers: { "Cache-Control": "no-store" },
          });
        }
        return new Response(sitemapXML(SITE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
