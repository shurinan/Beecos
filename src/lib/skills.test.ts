import { describe, expect, it } from "vitest";
import {
  SKILL_LEVELS,
  clampLevel,
  formatRating,
  levelLabel,
  normalizeSkill,
  skillBadges,
  sortSkills,
  topSkill,
} from "./skills";
import { pickAd, safeHttpUrl, shouldShowFeedAd, type Ad } from "./ads";

describe("skill levels", () => {
  it("has the three levels from the skill form", () => {
    expect(SKILL_LEVELS.map((l) => l.label)).toEqual([
      "Quase profissional",
      "Profissional",
      "Especialista",
    ]);
    expect(levelLabel(1)).toBe("Quase profissional");
    expect(levelLabel(3)).toBe("Especialista");
  });

  it("falls back to level 1 for unknown values and clamps input to 1..3", () => {
    expect(levelLabel(99)).toBe("Quase profissional");
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(7)).toBe(3);
    expect(clampLevel(1.6)).toBe(2);
    expect(clampLevel(Number.NaN)).toBe(1);
  });

  it("sorts highest level first, then by name, without mutating the input", () => {
    const input = [
      { skill: "Pintura", level: 2 },
      { skill: "Elétrica", level: 3 },
      { skill: "Alvenaria", level: 2 },
    ];
    expect(sortSkills(input).map((s) => s.skill)).toEqual(["Elétrica", "Alvenaria", "Pintura"]);
    expect(input[0]!.skill).toBe("Pintura");
    expect(topSkill(input)?.skill).toBe("Elétrica");
    expect(topSkill([])).toBeNull();
    expect(topSkill(null)).toBeNull();
  });

  it("lists badges in form order and none when every answer is no", () => {
    expect(skillBadges({ has_experience: false, had_training: false, certified: false })).toEqual(
      [],
    );
    expect(skillBadges({ has_experience: true, had_training: false, certified: true })).toEqual([
      "Experiência profissional",
      "Licenciado/certificado",
    ]);
    expect(skillBadges({ has_experience: true, had_training: true, certified: true })).toHaveLength(
      3,
    );
  });

  it("normalizes names so 'Pintura' and ' pintura ' are the same skill", () => {
    expect(normalizeSkill(" Elétrica ")).toBe("eletrica");
    expect(normalizeSkill("PINTURA")).toBe(normalizeSkill("pintura"));
  });

  it("formats ratings with a comma and a dash when there is none", () => {
    expect(formatRating(4.5)).toBe("4,5");
    expect(formatRating("5.0")).toBe("5,0");
    expect(formatRating(null)).toBe("—");
    expect(formatRating(0)).toBe("—");
  });
});

const ad = (over: Partial<Ad> = {}): Ad => ({
  id: "1",
  placement: "feed",
  sponsor: "Loja",
  title: "Ferramentas",
  body: "",
  image_url: null,
  link_url: "https://loja.com",
  ...over,
});

describe("ads", () => {
  it("only accepts http(s) links", () => {
    expect(safeHttpUrl("https://a.com/x?y=1")).toBe("https://a.com/x?y=1");
    expect(safeHttpUrl("http://a.com")).toBe("http://a.com/");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it("drops ads with unsafe links and picks stably by seed", () => {
    const list = [ad({ id: "a" }), ad({ id: "bad", link_url: "javascript:x" }), ad({ id: "b" })];
    expect(pickAd(list, 0)?.id).toBe("a");
    expect(pickAd(list, 1)?.id).toBe("b");
    expect(pickAd(list, 2)?.id).toBe("a");
    expect(pickAd([ad({ link_url: "javascript:x" })], 0)).toBeNull();
    expect(pickAd([], 0)).toBeNull();
    expect(pickAd(undefined, 0)).toBeNull();
  });

  it("shows a feed ad only when there are items after it", () => {
    expect(shouldShowFeedAd(4)).toBe(false);
    expect(shouldShowFeedAd(5)).toBe(true);
  });
});
