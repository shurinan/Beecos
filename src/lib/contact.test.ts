import { describe, expect, it } from "vitest";
import {
  addressLines,
  ageFromBirthDate,
  avatarPath,
  formatBirthDate,
  formatCep,
  formatMethods,
  isValidBirthDate,
  isValidCep,
  isValidPhone,
  joinFullName,
  phoneLimitMessage,
  validateAvatarFile,
} from "./contact";

describe("phones and CEP", () => {
  it("validates phones by digit count", () => {
    expect(isValidPhone("(11) 98818-2720")).toBe(true);
    expect(isValidPhone("+55 11 98818-2720")).toBe(true);
    expect(isValidPhone("1234")).toBe(false);
    expect(isValidPhone("1".repeat(16))).toBe(false);
  });
  it("formats and validates CEP", () => {
    expect(formatCep("07272720")).toBe("07272-720");
    expect(formatCep("07272-72099")).toBe("07272-720");
    expect(formatCep("0727")).toBe("0727");
    expect(isValidCep("07272-720")).toBe(true);
    expect(isValidCep("0727")).toBe(false);
  });
  it("lists methods in a fixed order", () => {
    expect(formatMethods(["whatsapp", "call"])).toBe("Ligação, WhatsApp");
  });
  it("recognises the phone limit error", () => {
    expect(phoneLimitMessage({ message: "LIMITE_TELEFONES" })).toBe("Máximo de 10 telefones.");
    expect(phoneLimitMessage({ message: "outro" })).toBeNull();
    expect(phoneLimitMessage(null)).toBeNull();
  });
});

describe("address", () => {
  it("skips empty lines", () => {
    expect(
      addressLines({
        kind: "physical",
        recipient: "Bruno",
        care_of: "",
        street: "R. Benjamin Pinto, 269",
        neighborhood: "",
        city: "Sorocaba",
        state: "SP",
        postal_code: "07272720",
      }),
    ).toEqual(["Bruno", "R. Benjamin Pinto, 269", "Sorocaba - SP", "07272-720"]);
  });
});

describe("birth date", () => {
  const today = new Date(2026, 9, 26); // 26/10/2026
  it("computes age before and after the birthday", () => {
    expect(ageFromBirthDate("1990-10-26", today)).toBe(36);
    expect(ageFromBirthDate("1990-10-27", today)).toBe(35);
    expect(ageFromBirthDate("2027-01-01", today)).toBeNull();
    expect(ageFromBirthDate("lixo", today)).toBeNull();
  });
  it("validates range", () => {
    expect(isValidBirthDate("1990-05-01", today)).toBe(true);
    expect(isValidBirthDate("1899-12-31", today)).toBe(false);
    expect(isValidBirthDate("2026-10-27", today)).toBe(false);
    expect(isValidBirthDate("", today)).toBe(false);
  });
  it("formats as dd/mm/yyyy", () => {
    expect(formatBirthDate("1990-05-01")).toBe("01/05/1990");
    expect(formatBirthDate("")).toBe("");
  });
});

describe("names and avatar", () => {
  it("joins name parts skipping blanks", () => {
    expect(
      joinFullName({
        first_name: "Bruno",
        other_names: " dos Santos ",
        last_name: "Espíndola",
        name_suffix: "",
      }),
    ).toBe("Bruno dos Santos Espíndola");
  });
  it("validates avatar files", () => {
    expect(validateAvatarFile({ type: "image/png", size: 100 })).toBeNull();
    expect(validateAvatarFile({ type: "image/gif", size: 100 })).toMatch(/JPG, PNG ou WebP/);
    expect(validateAvatarFile({ type: "image/png", size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
  });
  it("builds a path inside the owner's folder", () => {
    expect(avatarPath("abc", "image/webp", 5)).toBe("abc/5.webp");
  });
});
