import { describe, expect, it } from "vitest";
import { tierOf, type BadgeInfo } from "./badges";
import { checkImageFile, verificationErrorMessage } from "./verification";

const base: BadgeInfo = { premium: false, doc: false, email: true, address: false, phone: false };

describe("tierOf", () => {
  it("sem documento nem plano: sem selo", () => expect(tierOf(base)).toBeNull());
  it("documento aprovado: Verificado", () =>
    expect(tierOf({ ...base, doc: true })).toBe("verified"));
  it("plano ativo: Premium", () => expect(tierOf({ ...base, premium: true })).toBe("premium"));
  it("os dois: dourado", () => expect(tierOf({ ...base, doc: true, premium: true })).toBe("both"));
  it("sem dados: sem selo", () => expect(tierOf(null)).toBeNull());
});

describe("checkImageFile", () => {
  it("aceita JPG pequeno", () =>
    expect(checkImageFile({ type: "image/jpeg", size: 1000 })).toBeNull());
  it("recusa PDF", () =>
    expect(checkImageFile({ type: "application/pdf", size: 1000 })).toMatch(/JPG/));
  it("recusa acima de 5 MB", () =>
    expect(checkImageFile({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/5 MB/));
});

describe("verificationErrorMessage", () => {
  it("traduz pedido repetido", () =>
    expect(verificationErrorMessage({ message: "duplicate key ... one_pending" })).toMatch(
      /em análise/,
    ));
  it("ignora erro desconhecido", () =>
    expect(verificationErrorMessage({ message: "x" })).toBeNull());
});
