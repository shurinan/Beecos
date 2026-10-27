import { describe, expect, it } from "vitest";
import { suggestionErrorMessage, suggestionValid } from "./suggestions";

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
