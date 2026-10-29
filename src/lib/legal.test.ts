import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TERMS_VERSION, accountErrorMessage, termsErrorMessage } from "./legal";

describe("legal", () => {
  it("a versão dos termos é a mesma do banco", () => {
    const sql = readFileSync("drizzle/migrations/0037_cancel_and_terms.sql", "utf8");
    expect(sql).toContain(`SELECT '${TERMS_VERSION}'`);
  });
  it("traduz os erros", () => {
    expect(termsErrorMessage({ message: "TERMOS_DESATUALIZADOS" })).toMatch(/atualizados/);
    expect(accountErrorMessage({ message: "CONTA_COM_SERVICO_ATIVO" })).toMatch(/em andamento/);
    expect(accountErrorMessage({ message: "x" })).toBeNull();
  });
});
