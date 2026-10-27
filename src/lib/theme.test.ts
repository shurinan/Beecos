import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_INIT_SCRIPT,
  THEME_KEY,
  applyTheme,
  isThemePref,
  readPref,
  resolveTheme,
} from "@/lib/theme";

function mockSystem(dark: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: dark && q.includes("dark"),
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("follows the system by default and lets the person override", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("reads only valid saved values", () => {
    expect(readPref()).toBe("system");
    localStorage.setItem(THEME_KEY, "dark");
    expect(readPref()).toBe("dark");
    localStorage.setItem(THEME_KEY, "banana");
    expect(readPref()).toBe("system");
    expect(isThemePref("light")).toBe(true);
    expect(isThemePref("x")).toBe(false);
  });
  it("puts the dark class on the page", () => {
    mockSystem(true);
    expect(applyTheme("system")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(applyTheme("light")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
  it("the early script applies the same rule before the page is drawn", () => {
    mockSystem(true);
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    document.documentElement.className = "";
    localStorage.setItem(THEME_KEY, "light");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    localStorage.setItem(THEME_KEY, "dark");
    mockSystem(false);
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
