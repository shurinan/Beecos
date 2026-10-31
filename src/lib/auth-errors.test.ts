import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";

describe("authErrorMessage", () => {
  it("traduz pelo código do erro", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "x" }, "in")).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(authErrorMessage({ code: "weak_password" }, "up")).toBe(
      "A senha é fraca. Use pelo menos 8 caracteres, misturando letras e números.",
    );
  });

  it("traduz pelo texto quando não há código", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"), "in")).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(authErrorMessage(new Error("User already registered"), "up")).toBe(
      "Já existe uma conta com esse e-mail.",
    );
    expect(authErrorMessage(new Error("Failed to fetch"), "in")).toBe(
      "Sem conexão. Confira a internet e tente de novo.",
    );
  });

  it("nunca mostra o inglês: cai na frase padrão", () => {
    expect(authErrorMessage(new Error("Something unexpected"), "in")).toBe(
      "Não foi possível entrar. Tente de novo.",
    );
    expect(authErrorMessage(null, "up")).toBe("Não foi possível criar a conta. Tente de novo.");
  });
});
