import { describe, expect, it } from "vitest";
import { NO_PROFESSION, postParams, profileParam } from "@/lib/urls";

describe("urls", () => {
  it("uses the readable name for a profile, or the id as a fallback", () => {
    expect(profileParam({ id: "u1", slug: "bruno-espindola" })).toBe("bruno-espindola");
    expect(profileParam({ id: "u1", slug: null })).toBe("u1");
    expect(profileParam({ id: "u1" })).toBe("u1");
  });
  it("builds /vagas/profissao/codigo", () => {
    expect(
      postParams({ slug: "chuveiro-queimou-a3f9c1", professions: { slug: "eletricista" } }),
    ).toEqual({
      profissao: "eletricista",
      codigo: "chuveiro-queimou-a3f9c1",
    });
  });
  it("puts a post without a catalog profession under outros", () => {
    expect(postParams({ slug: "x-111111", professions: null }).profissao).toBe(NO_PROFESSION);
    expect(postParams({ slug: "x-111111" }).profissao).toBe("outros");
  });
});
