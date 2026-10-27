import { describe, expect, it } from "vitest";
import { clampVacancies, draftError, EMPTY_DRAFT } from "@/lib/post-form";

const ok = {
  ...EMPTY_DRAFT,
  title: "Trocar chuveiro",
  cep: "18087-310",
  pick: { professionId: "p1", other: false, serviceIds: [] },
};

describe("post-form", () => {
  it("accepts a complete job", () => expect(draftError(ok)).toBeNull());
  it("asks for title, profession and CEP", () => {
    expect(draftError({ ...ok, title: " " })).toMatch(/título/);
    expect(draftError({ ...ok, pick: EMPTY_DRAFT.pick })).toMatch(/profissão/);
    expect(draftError({ ...ok, cep: "" })).toMatch(/CEP/);
  });
  it("does not allow fewer vacancies than the occupied ones", () => {
    expect(draftError({ ...ok, vacancies: 1 }, 2)).toMatch(/ocupadas/);
  });
  it("clamps vacancies", () => {
    expect(clampVacancies(0)).toBe(1);
    expect(clampVacancies(99)).toBe(20);
  });
});
