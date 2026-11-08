import { describe, expect, it } from "vitest";
import {
  cityName,
  citySlug,
  maskCityOrCep,
  publicCity,
  validateCityOrCep,
} from "./location";

describe("validateCityOrCep", () => {
  it("accepts a city", () => {
    expect(validateCityOrCep("Sorocaba - SP")).toBeNull();
    expect(validateCityOrCep("São José dos Campos")).toBeNull();
    expect(validateCityOrCep("Sorocaba, SP")).toBeNull();
  });

  it("accepts a CEP only in the 00000-000 format", () => {
    expect(validateCityOrCep("18010-000")).toBeNull();
    expect(validateCityOrCep("18010000")).toBe("Escreva o CEP no formato 00000-000.");
    expect(validateCityOrCep("1801-000")).toBe("Escreva o CEP no formato 00000-000.");
  });

  it("refuses street, number, neighborhood and complement", () => {
    expect(validateCityOrCep("Rua das Flores, 123")).not.toBeNull();
    expect(validateCityOrCep("Av. Paulista")).not.toBeNull();
    expect(validateCityOrCep("Sorocaba, Centro")).not.toBeNull();
    expect(validateCityOrCep("Bairro Jardim Europa")).not.toBeNull();
    expect(validateCityOrCep("Sorocaba apto 12")).not.toBeNull();
  });

  it("allows leaving it empty", () => {
    expect(validateCityOrCep("   ")).toBeNull();
  });
});

describe("maskCityOrCep", () => {
  it("adds the CEP hyphen while typing numbers and leaves city text alone", () => {
    expect(maskCityOrCep("18010000")).toBe("18010-000");
    expect(maskCityOrCep("Itu")).toBe("Itu");
  });
});

describe("publicCity", () => {
  it("never shows a CEP or a street address", () => {
    expect(publicCity("18010-000")).toBe("");
    expect(publicCity("Rua A, 10 - Centro")).toBe("");
    expect(publicCity("Itaquaquecetuba - SP")).toBe("Itaquaquecetuba - SP");
  });

  it("builds the city name and address used in /servicos", () => {
    expect(cityName("Itaquaquecetuba - SP")).toBe("Itaquaquecetuba");
    expect(citySlug("São José dos Pinhais")).toBe("sao-jose-dos-pinhais");
    expect(citySlug("18010-000")).toBe("");
  });
});
