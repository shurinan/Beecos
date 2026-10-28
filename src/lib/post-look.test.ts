import { Briefcase, Scissors, Zap } from "lucide-react";
import { describe, expect, it } from "vitest";
import { COVER_COLORS, coverColor, professionIcon } from "./post-look";

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
