import { describe, expect, it } from "vitest";
import { buildCatalog, catalogLabel, searchCatalog } from "./catalog";

const catalog = buildCatalog(
  [
    { id: "s1", name: "Construção civil", sort: 0, active: true },
    { id: "s2", name: "Beleza", sort: 1, active: true },
    { id: "s3", name: "Vazio", sort: 2, active: true },
  ],
  [
    {
      id: "p1",
      sector_id: "s1",
      name: "Eletricista",
      aliases: ["fiação", "bico de eletricista"],
      sort: 0,
      active: true,
    },
    { id: "p2", sector_id: "s1", name: "Pedreiro", aliases: ["alvenaria"], sort: 1, active: true },
    { id: "p3", sector_id: "s2", name: "Barbeiro", aliases: [], sort: 0, active: true },
    { id: "p4", sector_id: "s1", name: "Antigo", aliases: [], sort: 2, active: false },
  ],
  [
    {
      id: "v1",
      profession_id: "p1",
      name: "Instalação de chuveiro",
      aliases: ["chuveiro elétrico"],
      sort: 0,
      active: true,
    },
    { id: "v2", profession_id: "p1", name: "Aterramento", aliases: [], sort: 1, active: false },
    { id: "v3", profession_id: "p2", name: "Reboco", aliases: [], sort: 0, active: true },
  ],
);

describe("buildCatalog", () => {
  it("keeps only active professions and services in the lists, in order", () => {
    expect(catalog.sectors.map((s) => s.name)).toEqual(["Construção civil", "Beleza"]);
    expect(catalog.sectors[0]!.professions.map((p) => p.name)).toEqual(["Eletricista", "Pedreiro"]);
    expect(catalog.professions.get("p1")!.services.map((s) => s.name)).toEqual([
      "Instalação de chuveiro",
    ]);
  });

  it("still knows deactivated items by id, to show old records", () => {
    expect(catalog.professions.get("p4")!.name).toBe("Antigo");
    expect(catalog.services.get("v2")!.name).toBe("Aterramento");
  });
});

describe("searchCatalog", () => {
  it("finds by name ignoring case and accents", () => {
    expect(searchCatalog(catalog, "ELETRICISTA")[0]!.profession.id).toBe("p1");
    expect(searchCatalog(catalog, "instalacao")[0]!.service!.id).toBe("v1");
  });

  it("finds by nickname", () => {
    expect(searchCatalog(catalog, "fiacao")[0]!.profession.id).toBe("p1");
    expect(searchCatalog(catalog, "bico de eletricista")[0]!.profession.id).toBe("p1");
    expect(searchCatalog(catalog, "chuveiro")[0]!.service!.id).toBe("v1");
  });

  it("matches a service through its profession's name", () => {
    const hits = searchCatalog(catalog, "eletricista chuveiro");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.service!.id).toBe("v1");
  });

  it("needs every word, ignores deactivated items and empty text", () => {
    expect(searchCatalog(catalog, "pedreiro chuveiro")).toEqual([]);
    expect(searchCatalog(catalog, "aterramento")).toEqual([]);
    expect(searchCatalog(catalog, "antigo")).toEqual([]);
    expect(searchCatalog(catalog, "   ")).toEqual([]);
  });

  it("puts names that start with the text before the others", () => {
    const hits = searchCatalog(catalog, "e");
    expect(hits[0]!.profession.name).toBe("Eletricista");
  });
});

describe("catalogLabel", () => {
  it("joins profession and service", () => {
    expect(catalogLabel({ name: "Eletricista" }, { name: "Chuveiro" })).toBe(
      "Eletricista · Chuveiro",
    );
    expect(catalogLabel({ name: "Eletricista" }, null)).toBe("Eletricista");
    expect(catalogLabel(null, null)).toBe("");
  });
});
