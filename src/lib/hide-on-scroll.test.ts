import { describe, expect, it } from "vitest";
import { nextHidden } from "./hide-on-scroll";

describe("nextHidden", () => {
  it("hides when scrolling down and shows when scrolling up", () => {
    expect(nextHidden(100, 200, false)).toBe(true);
    expect(nextHidden(300, 200, true)).toBe(false);
  });
  it("always shows near the top", () => {
    expect(nextHidden(10, 30, true)).toBe(false);
  });
  it("ignores small finger jitter", () => {
    expect(nextHidden(200, 205, true)).toBe(true);
    expect(nextHidden(200, 195, false)).toBe(false);
  });
});
