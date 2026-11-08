import { describe, expect, it } from "vitest";
import {
  loadDynamicSitemapEntries,
  postSitemapEntries,
  SITEMAP_POST_LIMIT,
  type SitemapPostRow,
} from "./sitemap-dynamic";

const NOW = new Date("2026-11-08T12:00:00Z").getTime();

const row = (over: Partial<SitemapPostRow>): SitemapPostRow => ({
  slug: "post-1",
  city: "Itaquaquecetuba - SP",
  created_at: "2026-11-01T10:00:00Z",
  expires_at: null,
  closed_at: null,
  hidden_at: null,
  professions: { slug: "eletricista" },
  ...over,
});

describe("postSitemapEntries", () => {
  it("lists open posts newest first with lastmod", () => {
    const entries = postSitemapEntries(
      [
        row({ slug: "antigo", created_at: "2026-10-01T00:00:00Z" }),
        row({ slug: "novo", created_at: "2026-11-05T00:00:00Z" }),
      ],
      NOW,
    );
    expect(entries.slice(0, 2)).toEqual([
      { path: "/v/novo", lastmod: "2026-11-05T00:00:00Z" },
      { path: "/v/antigo", lastmod: "2026-10-01T00:00:00Z" },
    ]);
  });

  it("leaves out hidden, closed and expired posts", () => {
    const paths = postSitemapEntries(
      [
        row({ slug: "oculto", hidden_at: "2026-11-02T00:00:00Z" }),
        row({ slug: "encerrado", closed_at: "2026-11-02T00:00:00Z" }),
        row({ slug: "vencido", expires_at: "2026-11-07T00:00:00Z" }),
      ],
      NOW,
    ).map((e) => e.path);
    expect(paths).toEqual([]);
  });

  it("includes profession and city pages only when they have an open post", () => {
    const paths = postSitemapEntries(
      [
        row({ slug: "a" }),
        row({ slug: "b", professions: { slug: "pedreiro" }, closed_at: "2026-11-02T00:00:00Z" }),
      ],
      NOW,
    ).map((e) => e.path);
    expect(paths).toContain("/servicos/eletricista");
    expect(paths).toContain("/servicos/eletricista/itaquaquecetuba");
    expect(paths.some((p) => p.includes("pedreiro"))).toBe(false);
  });

  it("never puts a CEP in a URL", () => {
    const paths = postSitemapEntries([row({ city: "08500-000" })], NOW).map((e) => e.path);
    expect(paths).toEqual(["/v/post-1", "/servicos/eletricista"]);
  });

  it("keeps at most 5000 posts", () => {
    const rows = Array.from({ length: SITEMAP_POST_LIMIT + 3 }, (_, i) =>
      row({ slug: `p-${i}`, professions: null }),
    );
    expect(SITEMAP_POST_LIMIT).toBe(5000);
    expect(postSitemapEntries(rows, NOW)).toHaveLength(5000);
  });
});

describe("loadDynamicSitemapEntries", () => {
  it("returns nothing extra when the read fails, so only static routes remain", async () => {
    const entries = await loadDynamicSitemapEntries(async () => {
      throw new Error("offline");
    }, NOW);
    expect(entries).toEqual([]);
  });
});
