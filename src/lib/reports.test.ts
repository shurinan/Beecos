import { describe, expect, it } from "vitest";
import { REPORT_REASONS, reportErrorMessage } from "./reports";

describe("reports", () => {
  it("traduz os erros do banco", () => {
    expect(reportErrorMessage({ message: "DENUNCIA_REPETIDA" })).toMatch(/já denunciou/);
    expect(reportErrorMessage({ message: "DENUNCIA_PROPRIA" })).toMatch(/seu próprio/);
    expect(reportErrorMessage({ message: "DENUNCIAS_DEMAIS" })).toMatch(/muitas/);
    expect(reportErrorMessage({ message: "outro erro" })).toBeNull();
    expect(reportErrorMessage(null)).toBeNull();
  });
  it("os motivos batem com os aceitos pelo banco", () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual([
      "golpe",
      "ofensivo",
      "falso",
      "contato_externo",
      "outro",
    ]);
  });
});
