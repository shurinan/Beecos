import { describe, expect, it } from "vitest";
import { jsonLdString, NOINDEX, postJsonLd, postRobots, type SeoPost } from "./seo";

const NOW = new Date("2026-11-08T12:00:00Z").getTime();

const base: SeoPost = {
  slug: "eletricista-66e53b",
  kind: "available",
  title: "Eletricista",
  description: "Instalações e reparos.",
  city: "Sorocaba - SP",
  created_at: "2026-11-01T10:00:00Z",
  expires_at: null,
  closed_at: null,
  hidden_at: null,
};

describe("postRobots (noindex da página /v/codigo)", () => {
  it("indexes an open post", () => {
    expect(postRobots(base, NOW)).toBeNull();
  });

  it("marks noindex,nofollow when the post does not exist", () => {
    expect(postRobots(null, NOW)).toBe(NOINDEX);
    expect(NOINDEX).toBe("noindex,nofollow");
  });

  it("marks noindex when closed, expired or hidden", () => {
    expect(postRobots({ ...base, closed_at: "2026-11-05T00:00:00Z" }, NOW)).toBe(NOINDEX);
    expect(postRobots({ ...base, expires_at: "2026-11-07T00:00:00Z" }, NOW)).toBe(NOINDEX);
    expect(postRobots({ ...base, hidden_at: "2026-11-05T00:00:00Z" }, NOW)).toBe(NOINDEX);
  });

  it("still indexes a post whose deadline is in the future", () => {
    expect(postRobots({ ...base, expires_at: "2026-12-01T00:00:00Z" }, NOW)).toBeNull();
  });
});

describe("postJsonLd", () => {
  it("uses Service with areaServed = city (without the state) for a professional", () => {
    expect(postJsonLd(base, NOW)).toEqual({
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Eletricista",
      description: "Instalações e reparos.",
      areaServed: { "@type": "City", name: "Sorocaba" },
      url: "https://beecos.com.br/v/eletricista-66e53b",
    });
  });

  it("leaves out a CEP or street written in the city", () => {
    const ld = postJsonLd({ ...base, city: "18010-000" }, NOW)!;
    expect(ld["areaServed"]).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain("18010");
  });

  it("omits the job JSON-LD because the post has no hiring organization", () => {
    expect(postJsonLd({ ...base, kind: "job" }, NOW)).toBeNull();
  });

  it("omits JSON-LD for closed posts", () => {
    expect(postJsonLd({ ...base, closed_at: "2026-11-05T00:00:00Z" }, NOW)).toBeNull();
  });

  it("cannot close the script tag through the text", () => {
    expect(jsonLdString({ d: "</script><b>" })).not.toContain("</script>");
  });
});
