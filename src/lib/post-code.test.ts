import { describe, expect, it } from "vitest";
import { parsePostCode, postCode } from "./post-code";

describe("código da vaga", () => {
  it("tira o código do endereço", () => {
    expect(postCode("chuveiro-queimou-a3f9c1")).toBe("A3F9C1");
    expect(postCode("sem-codigo")).toBeNull();
    expect(postCode(null)).toBeNull();
  });
  it("reconhece o código digitado na busca", () => {
    expect(parsePostCode("A3F9C1")).toBe("a3f9c1");
    expect(parsePostCode(" #a3f9c1 ")).toBe("a3f9c1");
    expect(parsePostCode("chuveiro-queimou-a3f9c1")).toBe("a3f9c1");
    expect(
      parsePostCode("https://beecos.lovable.app/vagas/eletricista/chuveiro-queimou-a3f9c1"),
    ).toBe("a3f9c1");
  });
  it("não confunde palavras comuns com código", () => {
    expect(parsePostCode("pedreiro")).toBeNull();
    expect(parsePostCode("limpeza de casa")).toBeNull();
    expect(parsePostCode("")).toBeNull();
  });
});
