import { describe, expect, it } from "vitest";
import { isValidUsernameFormat, normalizeUsername, usernameErrorMessage } from "@/lib/username";

describe("username", () => {
  it("normalizes what is typed", () => {
    expect(normalizeUsername("@Bruno Espíndola.S")).toBe("brunoespindola.s");
    expect(normalizeUsername("a".repeat(40))).toHaveLength(30);
  });
  it("accepts the Instagram-like format", () => {
    for (const ok of ["brunoespindola.s", "bruno_s", "abc", "a-b.c_d", "_abc_"])
      expect(isValidUsernameFormat(ok), ok).toBe(true);
  });
  it("rejects bad formats", () => {
    for (const bad of [
      "ab",
      ".abc",
      "abc.",
      "a..b",
      "a--b",
      "-abc",
      "Abc",
      "bruno s",
      "a".repeat(31),
    ])
      expect(isValidUsernameFormat(bad), bad).toBe(false);
  });
  it("explains database errors", () => {
    expect(usernameErrorMessage({ message: "USUARIO_EM_USO" })).toMatch(/já está em uso/);
    expect(usernameErrorMessage({ message: "USUARIO_INVALIDO" })).toMatch(/inválido/);
    expect(usernameErrorMessage({ message: "x" })).toBeNull();
  });
});
