import { describe, expect, it } from "vitest";
import { helpFor } from "./help";

describe("helpFor", () => {
  it("acha pelo nome, sem ligar para caixa e espaços", () => {
    expect(helpFor("  Meu   Perfil ")?.title).toBe("Meu perfil");
  });
  it("aceita rótulos com contador", () => {
    expect(helpFor("Avisos, 3 não lidos")?.title).toBe("Avisos");
  });
  it("ignora o que não conhece", () => {
    expect(helpFor("Qualquer coisa")).toBeNull();
    expect(helpFor("")).toBeNull();
    expect(helpFor(null)).toBeNull();
  });
});
