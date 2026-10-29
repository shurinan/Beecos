import { describe, expect, it } from "vitest";
import { limitMessage } from "@/lib/plans";
import { MAX_NEGOTIATIONS, serviceErrorMessage } from "@/lib/services";

describe("negotiation limit messages", () => {
  it("says the job is full for the interested person", () => {
    expect(limitMessage({ message: "NEGOCIACOES_CHEIAS" })).toMatch(/preenchida/);
  });
  it("says it was closed", () => {
    expect(limitMessage({ message: "NEGOCIACAO_ENCERRADA" })).toMatch(/encerrou/);
  });
  it("explains the owner errors", () => {
    expect(serviceErrorMessage({ message: "NEGOCIACOES_CHEIAS" })).toMatch(/Encerre uma/);
    expect(serviceErrorMessage({ message: "SERVICO_EM_ANDAMENTO" })).toMatch(/escolhida/);
    expect(MAX_NEGOTIATIONS).toBe(5);
  });
});
