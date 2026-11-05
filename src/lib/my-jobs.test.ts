import { describe, expect, it } from "vitest";
import { interestBadge, interestRank, isOpen, postBadges, type MyPost } from "./my-jobs";

const base: MyPost = {
  id: "p1",
  kind: "job",
  title: "Instalar chuveiro",
  price: "R$ 150",
  city: "Centro",
  slug: "instalar-chuveiro-1",
  profession_id: null,
  professions: null,
  closed_at: null,
  expires_at: null,
  hidden_at: null,
  created_at: "2026-11-01T00:00:00Z",
  interested: 0,
  engagements: [],
  partner: null,
};

describe("isOpen", () => {
  it("closes on concluded, hidden or expired", () => {
    expect(isOpen(base)).toBe(true);
    expect(isOpen({ ...base, closed_at: "x" })).toBe(false);
    expect(isOpen({ ...base, hidden_at: "x" })).toBe(false);
    expect(isOpen({ ...base, expires_at: "2000-01-01T00:00:00Z" })).toBe(false);
  });
});

describe("postBadges", () => {
  it("counts interested people on an open job", () => {
    expect(postBadges({ ...base, interested: 5 }).map((b) => b.text)).toEqual(["5 interessados"]);
    expect(postBadges({ ...base, interested: 1 })[0]?.text).toBe("1 interessado");
  });
  it("shows who it was agreed with", () => {
    const b = postBadges({ ...base, interested: 2, engagements: ["accepted"], partner: "Rafael" });
    expect(b[0]).toEqual({ text: "Combinado com Rafael", tone: "green" });
  });
  it("says when nobody is interested yet", () => {
    expect(postBadges(base)[0]?.text).toBe("Ainda sem interessados");
  });
  it("talks about hiring on an availability ad", () => {
    expect(postBadges({ ...base, kind: "available", interested: 2 })[0]?.text).toBe(
      "2 querem contratar",
    );
  });
});

describe("interestBadge", () => {
  const i = { closed: false, engagement: null, post: base };
  it("follows the service status", () => {
    expect(interestBadge(i).text).toBe("Conversando");
    expect(interestBadge({ ...i, engagement: "proposed" }).text).toBe("Você foi escolhido: aceite");
    expect(interestBadge({ ...i, engagement: "accepted" }).text).toBe("Combinado");
    expect(interestBadge({ ...i, closed: true }).text).toBe("Negociação encerrada");
    expect(interestBadge({ ...i, post: { ...base, closed_at: "x" } }).text).toBe("Vaga encerrada");
  });
  it("puts being chosen first", () => {
    expect(interestRank({ ...i, engagement: "proposed" })).toBeLessThan(interestRank(i));
    expect(interestRank(i)).toBeLessThan(interestRank({ ...i, closed: true }));
  });
});
