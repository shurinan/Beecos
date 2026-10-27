import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, activeFilterCount, parseMoneyInput, searchArgs } from "./discovery";

describe("parseMoneyInput", () => {
  it("reads Brazilian numbers", () => {
    expect(parseMoneyInput("350")).toBe(350);
    expect(parseMoneyInput("1.200")).toBe(1200);
    expect(parseMoneyInput("1.200,50")).toBe(1200.5);
    expect(parseMoneyInput(" 80,5 ")).toBe(80.5);
  });

  it("ignores empty or invalid text", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
  });
});

describe("searchArgs", () => {
  it("sends only what was filled in", () => {
    expect(searchArgs(EMPTY_FILTERS)).toEqual({
      _kind: "job",
      _city: "",
      _q: "",
      _only_premium: false,
      _limit: 50,
    });
  });

  it("converts prices and rating to numbers", () => {
    const a = searchArgs({
      ...EMPTY_FILTERS,
      kind: "available",
      q: " pedreiro ",
      city: " Osasco ",
      minPrice: "100",
      maxPrice: "1.000",
      minRating: "4.5",
      onlyPremium: true,
    });
    expect(a).toMatchObject({
      _kind: "available",
      _q: "pedreiro",
      _city: "Osasco",
      _min_price: 100,
      _max_price: 1000,
      _min_rating: 4.5,
      _only_premium: true,
    });
  });
});

describe("activeFilterCount", () => {
  it("counts filters but not the kind or the search text", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: "x", kind: "available" })).toBe(0);
    expect(
      activeFilterCount({
        ...EMPTY_FILTERS,
        city: "SP",
        minPrice: "10",
        minRating: "3",
        onlyPremium: true,
      }),
    ).toBe(4);
    expect(activeFilterCount({ ...EMPTY_FILTERS, minPrice: "abc" })).toBe(0);
  });
});
