import { describe, expect, it, vi } from "vitest";
import { GeoError, cepDigits, formatCep, formatKm, isValidCep, lookupCep } from "./geo";

const json = (status: number, body: unknown) =>
  ({ status, json: async () => body }) as unknown as Response;

const brasil = {
  city: "Osasco",
  state: "sp",
  neighborhood: "Centro",
  street: "Rua A",
  location: { coordinates: { latitude: "-23.5329", longitude: "-46.7917" } },
};

describe("CEP text", () => {
  it("keeps digits and formats with a dash", () => {
    expect(cepDigits("06010-000x9")).toBe("06010000");
    expect(formatCep("06010000")).toBe("06010-000");
    expect(formatCep("0601")).toBe("0601");
    expect(isValidCep("06010-000")).toBe(true);
    expect(isValidCep("0601")).toBe(false);
  });
});

describe("lookupCep", () => {
  it("uses the coordinates from the CEP service when they come", async () => {
    const fetcher = vi.fn(async (_url: string) => json(200, brasil));
    const p = await lookupCep("06010-000", fetcher);
    expect(p).toEqual({
      cep: "06010000",
      city: "Osasco",
      state: "SP",
      lat: -23.5329,
      lng: -46.7917,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toContain("/cep/v2/06010000");
  });

  it("searches the street, then the city, when there are no coordinates", async () => {
    const noPoint = { ...brasil, location: { coordinates: {} } };
    const fetcher = vi.fn(async (url: string) =>
      url.includes("brasilapi")
        ? json(200, noPoint)
        : url.includes("Rua%20A")
          ? json(200, [])
          : json(200, [{ lat: "-23.53", lon: "-46.79" }]),
    );
    const p = await lookupCep("06010000", fetcher);
    expect(p.lat).toBe(-23.53);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("ignores points outside Brazil", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("brasilapi")
        ? json(200, {
            ...brasil,
            location: { coordinates: { latitude: "48.8", longitude: "2.3" } },
          })
        : json(200, [{ lat: "48.8", lon: "2.3" }]),
    );
    await expect(lookupCep("06010000", fetcher)).rejects.toThrow("localizar esse CEP no mapa");
  });

  it("explains each failure in plain words", async () => {
    await expect(lookupCep("123")).rejects.toThrow("8 números");
    await expect(lookupCep("06010000", async () => json(404, {}))).rejects.toThrow(
      "CEP não encontrado",
    );
    await expect(lookupCep("06010000", async () => json(500, null))).rejects.toThrow(
      "Não consegui consultar",
    );
    await expect(
      lookupCep("06010000", async () => {
        throw new Error("offline");
      }),
    ).rejects.toBeInstanceOf(GeoError);
  });
});

describe("formatKm", () => {
  it("rounds in a friendly way", () => {
    expect(formatKm(0.4)).toBe("menos de 1 km");
    expect(formatKm(3.44)).toBe("3,4 km");
    expect(formatKm(12.6)).toBe("13 km");
    expect(formatKm(-1)).toBe("");
  });
});
