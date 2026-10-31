import { describe, expect, it } from "vitest";
import {
  channelErrorMessage,
  deadlineLabel,
  expiresAt,
  timeLeftLabel,
  DEADLINES,
} from "./channels";

const now = new Date("2026-10-31T12:00:00Z");

describe("prazos", () => {
  it("só há quatro prazos fixos, no máximo 30 dias", () => {
    expect(DEADLINES.map((d) => d.days)).toEqual([1, 3, 7, 30]);
  });
  it("calcula o fim da vaga", () => {
    expect(expiresAt(7, now)).toBe("2026-11-07T12:00:00.000Z");
    expect(expiresAt(1, now)).toBe("2026-11-01T12:00:00.000Z");
  });
  it("nomeia o prazo", () => {
    expect(deadlineLabel(1)).toBe("24 horas");
    expect(deadlineLabel(30)).toBe("30 dias");
  });
});

describe("timeLeftLabel", () => {
  it("sem prazo: nada", () => expect(timeLeftLabel(null, now)).toBeNull());
  it("horas quando falta menos de um dia", () =>
    expect(timeLeftLabel("2026-11-01T11:00:00Z", now)).toBe("Termina em 23 h"));
  it("dias quando falta mais", () =>
    expect(timeLeftLabel("2026-11-06T12:00:00Z", now)).toBe("Termina em 6 dias"));
  it("singular", () => expect(timeLeftLabel("2026-11-01T12:00:00Z", now)).toBe("Termina em 1 dia"));
  it("vencida: Encerrada", () =>
    expect(timeLeftLabel("2026-10-31T11:00:00Z", now)).toBe("Encerrada"));
});

describe("channelErrorMessage", () => {
  it("canal é Premium", () =>
    expect(channelErrorMessage({ message: "CANAL_SO_PREMIUM" })).toMatch(/Premium/));
  it("limite", () => expect(channelErrorMessage({ message: "LIMITE_CANAIS" })).toMatch(/3 canais/));
  it("desconhecido", () => expect(channelErrorMessage({ message: "x" })).toBeNull());
});
