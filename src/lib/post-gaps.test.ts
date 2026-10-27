import { describe, expect, it } from "vitest";
import { postGaps } from "./post-gaps";

describe("postGaps", () => {
  it("vaga completa não tem pendências", () => {
    expect(postGaps({ kind: "job", profession_id: "x", description: "Preciso", hasLocation: true })).toEqual([]);
  });
  it("vaga sem local e sem profissão", () => {
    const g = postGaps({ kind: "job", profession_id: null, description: "ok", hasLocation: false });
    expect(g).toHaveLength(2);
    expect(g[0]).toMatch(/^local/);
    expect(g[1]).toMatch(/^profissão/);
  });
  it("só pede local e profissão para vagas", () => {
    expect(postGaps({ kind: "available", description: "ok", hasLocation: false })).toEqual([]);
  });
  it("descrição vazia", () => {
    expect(postGaps({ kind: "available", description: "  ", hasLocation: false })).toEqual(["descrição"]);
  });
});
