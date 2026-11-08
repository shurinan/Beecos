import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { buildServicePage, SERVICE_PAGE_SIZE, servicePageMeta } from "./service-pages";

const NOW = new Date("2026-11-08T12:00:00Z").getTime();
const prof = { name: "Eletricista", slug: "eletricista" };
const row = (slug: string, city: string) => ({
  slug,
  kind: "available",
  title: "Eletricista",
  city,
  price: "R$100",
  created_at: "2026-11-01T00:00:00Z",
  expires_at: null,
  closed_at: null,
  hidden_at: null,
});

describe("service pages", () => {
  it("filters by city and shows only the city, never the CEP", () => {
    const data = buildServicePage(
      prof,
      [row("a", "Itaquaquecetuba - SP"), row("b", "Sorocaba"), row("c", "08500-000")],
      "itaquaquecetuba",
      NOW,
    );
    expect(data.posts.map((p) => p.slug)).toEqual(["a"]);
    expect(data.city).toEqual({ slug: "itaquaquecetuba", name: "Itaquaquecetuba" });
    const all = buildServicePage(prof, [row("c", "08500-000")], undefined, NOW);
    expect(all.posts[0]?.city).toBe("");
  });

  it("shows at most 30 posts", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(`p${i}`, "Sorocaba"));
    expect(SERVICE_PAGE_SIZE).toBe(30);
    expect(buildServicePage(prof, rows, undefined, NOW).posts).toHaveLength(30);
  });

  it("uses a unique title and noindex when there is no open post", () => {
    const empty = buildServicePage(prof, [], "itaquaquecetuba", NOW);
    const meta = servicePageMeta(empty, { profissao: "eletricista", cidade: "itaquaquecetuba" });
    expect(meta.title).toBe("Eletricista em Itaquaquecetuba | Beecos");
    expect(meta.robots).toBe("noindex,nofollow");
    expect(meta.canonical).toBe("https://beecos.com.br/servicos/eletricista/itaquaquecetuba");

    const full = buildServicePage(prof, [row("a", "Itaquaquecetuba - SP")], "itaquaquecetuba", NOW);
    expect(servicePageMeta(full, { profissao: "eletricista", cidade: "itaquaquecetuba" }).robots).toBeNull();
  });
});
