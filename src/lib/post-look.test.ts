import { Briefcase, Scissors, Zap } from "lucide-react";
import { describe, expect, it } from "vitest";
import { COVER_COLORS, coverColor, professionIcon, resolveCover, resolveIcon } from "./post-look";

describe("coverColor", () => {
  it("é estável e vem da paleta", () => {
    expect(coverColor("eletricista")).toBe(coverColor("eletricista"));
    expect(COVER_COLORS).toContain(coverColor("pedreiro") as never);
    expect(COVER_COLORS).toContain(coverColor(null) as never);
  });
});

describe("professionIcon", () => {
  it("acha pelo nome, sem ligar para acento", () => {
    expect(professionIcon("Eletricista")).toBe(Zap);
    expect(professionIcon("Cabeleireira")).toBe(Scissors);
  });
  it("usa a maleta quando não conhece", () => {
    expect(professionIcon("Astronauta")).toBe(Briefcase);
    expect(professionIcon(undefined)).toBe(Briefcase);
  });
});

describe("escolhas de quem publica", () => {
  it("usa a escolha quando é válida e o padrão quando não é", () => {
    expect(resolveCover("#7FC8A9", "x")).toBe("#7FC8A9");
    expect(resolveCover("#000000", "x")).toBe(coverColor("x"));
    expect(resolveCover(null, "x")).toBe(coverColor("x"));
    expect(resolveIcon("scissors", "Eletricista")).toBe(Scissors);
    expect(resolveIcon(null, "Eletricista")).toBe(Zap);
    expect(resolveIcon("invalido", "Astronauta")).toBe(Briefcase);
  });
});
