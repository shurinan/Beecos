import { describe, expect, it } from "vitest";
import { brl, periodStart, planLabel } from "./admin";

describe("admin helpers", () => {
  it("starts the period at midnight, 7 days ago or day 1", () => {
    const now = new Date(2026, 10, 18, 15, 30);
    expect(periodStart("hoje", now)).toEqual(new Date(2026, 10, 18));
    expect(periodStart("mes", now)).toEqual(new Date(2026, 10, 1));
    expect(now.getTime() - periodStart("7dias", now).getTime()).toBe(7 * 86400_000);
  });
  it("names the plan", () => {
    expect(planLabel({ premium: false, plan_term: "monthly" })).toBe("Grátis");
    expect(planLabel({ premium: true, plan_term: "courtesy" })).toBe("Premium (cortesia)");
    expect(planLabel({ premium: true, plan_term: "annual" })).toBe("Premium anual");
  });
  it("formats money", () => {
    expect(brl(14.9)).toMatch(/R\$\s?14,90/);
  });
});
