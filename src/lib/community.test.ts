import { describe, expect, it } from "vitest";
import { communityErrorMessage, groupsSummary, inscritosLabel } from "./community";

describe("community", () => {
  it("rótulo de inscritos", () => {
    expect(inscritosLabel(0)).toBe("nenhum inscrito ainda");
    expect(inscritosLabel(1)).toBe("1 inscrito");
    expect(inscritosLabel(4)).toBe("4 inscritos");
  });
  it("resumo dos grupos", () => {
    expect(groupsSummary(3, 12)).toBe("Você está em 3 grupos · 12 vagas abertas");
    expect(groupsSummary(1, 1)).toBe("Você está em 1 grupo · 1 vaga aberta");
  });
  it("erro de limite de grupos", () => {
    expect(communityErrorMessage({ message: "GRUPOS_DEMAIS" })).toMatch(/30 grupos/);
    expect(communityErrorMessage({ message: "x" })).toBeNull();
  });
});
