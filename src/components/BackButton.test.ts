import { describe, expect, it } from "vitest";
import { parentPath, showBackButton } from "@/components/BackButton";

describe("showBackButton", () => {
  it("is hidden on the home page", () => expect(showBackButton("/")).toBe(false));
  it("is hidden on an open conversation, which has its own back arrow", () => {
    expect(showBackButton("/conversas/bruno-espindola")).toBe(false);
    expect(showBackButton("/conversas/bruno-espindola/")).toBe(false);
  });
  it("shows on the other pages", () => {
    for (const p of [
      "/vagas",
      "/vagas/eletricista/chuveiro-1253fd",
      "/vagas/eletricista/chuveiro-1253fd/interessados",
      "/perfil",
      "/perfil/bruno",
      "/perfil/contato",
      "/conversas",
      "/avisos",
      "/comunidade",
    ])
      expect(showBackButton(p), p).toBe(true);
  });
});

describe("parentPath", () => {
  it("climbs one level", () => {
    expect(parentPath("/vagas/eletricista/chuveiro-1/interessados")).toBe(
      "/vagas/eletricista/chuveiro-1",
    );
    expect(parentPath("/vagas/eletricista/chuveiro-1")).toBe("/vagas");
    expect(parentPath("/perfil/contato")).toBe("/perfil");
    expect(parentPath("/perfil/bruno")).toBe("/vagas");
  });
  it("falls back to the start only for the top-level pages", () => {
    for (const p of ["/vagas", "/perfil", "/conversas", "/avisos", "/comunidade"])
      expect(parentPath(p), p).toBe("/");
  });
});
