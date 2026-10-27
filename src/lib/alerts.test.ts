import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, pauseUntil, pausedNow, prefsSummary } from "@/lib/alerts";

const now = new Date("2026-10-27T12:00:00Z");

describe("alerts", () => {
  it("is on by default and not paused", () => {
    expect(pausedNow(DEFAULT_PREFS, now)).toBe(false);
    expect(prefsSummary(DEFAULT_PREFS, now)).toBe("Ligados");
  });
  it("pauses for N days and expires", () => {
    const until = pauseUntil(7, now);
    expect(pausedNow({ ...DEFAULT_PREFS, paused_until: until }, now)).toBe(true);
    expect(
      pausedNow({ ...DEFAULT_PREFS, paused_until: until }, new Date("2026-11-04T00:00:00Z")),
    ).toBe(false);
    expect(prefsSummary({ ...DEFAULT_PREFS, paused_until: until }, now)).toMatch(
      /^Pausados até \d+\/\d+$/,
    );
  });
  it("shows turned off", () => {
    expect(prefsSummary({ ...DEFAULT_PREFS, in_app: false }, now)).toBe("Desligados");
  });
});
