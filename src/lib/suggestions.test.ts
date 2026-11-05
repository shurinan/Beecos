import { describe, expect, it } from "vitest";
import {
  markNudgeShown,
  shouldShowNudge,
  suggestionBody,
  suggestionErrorMessage,
  suggestionValid,
} from "./suggestions";

describe("suggestions", () => {
  it("valida o tamanho", () => {
    expect(suggestionValid("  oi ")).toBe(false);
    expect(suggestionValid("Quero um filtro novo")).toBe(true);
    expect(suggestionValid("a".repeat(1001))).toBe(false);
  });
  it("traduz o limite diário", () => {
    expect(suggestionErrorMessage(new Error("SUGESTOES_DEMAIS"))).toMatch(/amanhã/);
    expect(suggestionErrorMessage(new Error("x"))).toBeNull();
  });
});

describe("suggestionBody and nudge", () => {
  it("puts the topic in front, except for a plain idea", () => {
    expect(suggestionBody("  mapa das vagas ")).toBe("mapa das vagas");
    expect(suggestionBody("o chat travou", "Algo não funciona")).toBe(
      "Algo não funciona: o chat travou",
    );
    expect(suggestionBody("mapa", "Ideia nova")).toBe("mapa");
  });
  it("shows the balloon on the first visit and again after 2 weeks", () => {
    localStorage.clear();
    expect(shouldShowNudge(1000)).toBe(true);
    markNudgeShown(1000);
    expect(shouldShowNudge(1000 + 86400_000)).toBe(false);
    expect(shouldShowNudge(1000 + 15 * 86400_000)).toBe(true);
  });
});
