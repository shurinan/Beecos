import { describe, expect, it } from "vitest";
import {
  availableActions,
  chooseLabel,
  isFilled,
  rankByArrival,
  serviceErrorMessage,
  vacanciesLabel,
  whatsappUrl,
} from "./services";

const base = { client_id: "c", provider_id: "p" };
const ctx = { iAmClient: true, providerReplied: true, hasPost: true, vacanciesLeft: true };

describe("availableActions", () => {
  it("lets only the client choose, and only after the provider replied", () => {
    expect(availableActions(null, "c", ctx).choose).toBe(true);
    expect(availableActions(null, "c", { ...ctx, providerReplied: false }).choose).toBe(false);
    expect(availableActions(null, "c", { ...ctx, vacanciesLeft: false }).choose).toBe(false);
    expect(availableActions(null, "c", { ...ctx, hasPost: false }).choose).toBe(false);
    expect(availableActions(null, "p", { ...ctx, iAmClient: false }).choose).toBe(false);
  });
  it("lets the client choose again after a cancellation", () => {
    expect(availableActions({ ...base, status: "cancelled" }, "c", ctx).choose).toBe(true);
  });
  it("proposed: provider accepts or declines, both can cancel", () => {
    const e = { ...base, status: "proposed" as const };
    expect(availableActions(e, "p", ctx)).toMatchObject({
      accept: true,
      decline: true,
      cancel: true,
      complete: false,
    });
    expect(availableActions(e, "c", ctx)).toMatchObject({
      accept: false,
      decline: false,
      cancel: true,
    });
  });
  it("accepted: either party completes or cancels", () => {
    const e = { ...base, status: "accepted" as const };
    for (const u of ["c", "p"])
      expect(availableActions(e, u, ctx)).toMatchObject({ complete: true, cancel: true });
  });
  it("completed: only reviewing; strangers do nothing", () => {
    const e = { ...base, status: "completed" as const };
    expect(availableActions(e, "c", ctx)).toMatchObject({
      review: true,
      complete: false,
      cancel: false,
    });
    expect(availableActions({ ...base, status: "accepted" }, "x", ctx)).toMatchObject({
      complete: false,
      cancel: false,
    });
  });
});

describe("labels and helpers", () => {
  it("uses a clear word on the choose button", () => {
    expect(chooseLabel("job")).toBe("Escolher este prestador");
    expect(chooseLabel("available")).toBe("Contratar");
  });
  it("describes vacancies", () => {
    expect(vacanciesLabel({ vacancies: 1, taken: 0 })).toBe("1 vaga");
    expect(vacanciesLabel({ vacancies: 1, taken: 1 })).toBe("Vaga preenchida");
    expect(vacanciesLabel({ vacancies: 3, taken: 1 })).toBe("2 de 3 vagas abertas");
    expect(vacanciesLabel({ vacancies: 3, taken: 3 })).toBe("Vagas preenchidas");
    expect(vacanciesLabel(null)).toBeNull();
    expect(isFilled({ vacancies: 2, taken: 2 })).toBe(true);
    expect(isFilled(undefined)).toBe(false);
  });
  it("numbers interested people by arrival", () => {
    const r = rankByArrival([
      { id: "b", created_at: "2026-10-02" },
      { id: "a", created_at: "2026-10-01" },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });
  it("translates database errors", () => {
    expect(serviceErrorMessage({ message: "VAGAS_PREENCHIDAS" })).toMatch(/vagas/);
    expect(serviceErrorMessage({ message: "algo estranho" })).toMatch(/Tente de novo/);
    expect(serviceErrorMessage(null)).toMatch(/Tente de novo/);
  });
  it("builds WhatsApp links", () => {
    expect(whatsappUrl("(11) 98818-2720")).toBe("https://wa.me/5511988182720");
    expect(whatsappUrl("+55 11 98818-2720")).toBe("https://wa.me/5511988182720");
    expect(whatsappUrl("123")).toBeNull();
  });
});
