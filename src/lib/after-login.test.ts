import { beforeEach, describe, expect, it } from "vitest";
import { rememberDestination, safeDestination, takeDestination } from "./after-login";

describe("destino depois de entrar", () => {
  beforeEach(() => sessionStorage.clear());
  it("só aceita endereços do próprio app", () => {
    expect(safeDestination("/publicar?tipo=contratar")).toBe("/publicar?tipo=contratar");
    expect(safeDestination("//site-ruim.com")).toBeNull();
    expect(safeDestination("https://site-ruim.com")).toBeNull();
    expect(safeDestination("/auth")).toBeNull();
    expect(safeDestination(42)).toBeNull();
  });
  it("lembra uma vez e esquece depois de usar", () => {
    rememberDestination("/conversas");
    expect(takeDestination()).toBe("/conversas");
    expect(takeDestination()).toBeNull();
  });
  it("expira depois de 30 minutos", () => {
    rememberDestination("/conversas");
    expect(takeDestination(Date.now() + 31 * 60_000)).toBeNull();
  });
});
