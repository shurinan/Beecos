import { describe, expect, it } from "vitest";
import { cpfDigits, formatCpf, isValidCpf } from "./cpf";

describe("cpf", () => {
  it("aceita CPF válido, com ou sem pontos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("recusa dígito errado, repetidos e tamanho errado", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("formata enquanto digita", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("5299")).toBe("529.9");
    expect(cpfDigits("529.982.247-25999")).toBe("52998224725");
  });
});
