import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  buildServicePage,
  SERVICE_PAGE_SIZE,
  servicePageMeta,
  serviceTitle,
} from "./service-pages";

const NOW = new Date("2026-11-08T12:00:00Z").getTime();
const prof = { name: "Eletricista", slug: "eletricista" };
const row = (slug: string, city: string) => ({
  slug,
  kind: "available",
  title: "Eletricista",
  city,
  price: "R$100",
  created_at: "2026-11-01T00:00:00Z",
  expires_at: null,
  closed_at: null,
  hidden_at: null,
});

describe("service pages", () => {
  it("filters by city and shows only the city, never the CEP", () => {
    const data = buildServicePage(
      prof,
      [row("a", "Itaquaquecetuba - SP"), row("b", "Sorocaba"), row("c", "08500-000")],
      "itaquaquecetuba",
      NOW,
    );
    expect(data.posts.map((p) => p.slug)).toEqual(["a"]);
    expect(data.city).toEqual({ slug: "itaquaquecetuba", name: "Itaquaquecetuba" });
    const all = buildServicePage(prof, [row("c", "08500-000")], undefined, NOW);
    expect(all.posts[0]?.city).toBe("");
  });

  it("shows at most 30 posts", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(`p${i}`, "Sorocaba"));
    expect(SERVICE_PAGE_SIZE).toBe(30);
    const data = buildServicePage(prof, rows, undefined, NOW);
    expect(data.posts).toHaveLength(30);
    expect(data.total).toBe(40);
  });

  it("uses a unique title and noindex when there is no open post", () => {
    const empty = buildServicePage(prof, [], "itaquaquecetuba", NOW);
    const meta = servicePageMeta(empty, { profissao: "eletricista", cidade: "itaquaquecetuba" });
    // 62 caracteres com " | Beecos": o sufixo sai.
    expect(meta.title).toBe("Eletricista em Itaquaquecetuba: profissionais e vagas");
    expect(meta.robots).toBe("noindex,nofollow");
    expect(meta.canonical).toBe("https://beecos.com.br/servicos/eletricista/itaquaquecetuba");

    const full = buildServicePage(prof, [row("a", "Itaquaquecetuba - SP")], "itaquaquecetuba", NOW);
    expect(servicePageMeta(full, { profissao: "eletricista", cidade: "itaquaquecetuba" }).robots).toBeNull();
  });

  it("counts only open posts of the page for total", () => {
    const rows = [
      row("a", "Sorocaba - SP"),
      row("b", "Sorocaba"),
      { ...row("c", "Sorocaba"), closed_at: "2026-11-02T00:00:00Z" },
      { ...row("d", "Sorocaba"), hidden_at: "2026-11-02T00:00:00Z" },
      { ...row("e", "Sorocaba"), expires_at: "2026-11-07T00:00:00Z" },
      row("f", "Itu"),
    ];
    expect(buildServicePage(prof, rows, "sorocaba", NOW).total).toBe(2);
    expect(buildServicePage(prof, rows, undefined, NOW).total).toBe(3);
  });

  const meta = (name: string, n: number, cidade?: string) => {
    const city = cidade ? "Sorocaba - SP" : "Itu";
    const rows = Array.from({ length: n }, (_, i) => row(`p${i}`, city));
    const data = buildServicePage({ name, slug: "x" }, rows, cidade, NOW);
    return servicePageMeta(data, cidade ? { profissao: "x", cidade } : { profissao: "x" });
  };
  const PITCH = "Converse direto pelo chat e combine o serviço. Precisou? Achou. Combinou? Fechou.";

  it("city page with n >= 3 uses the real count, beyond the 30 shown", () => {
    const m = meta("Pedreiro", 42, "sorocaba");
    expect(m.title).toBe("Pedreiro em Sorocaba: profissionais e vagas | Beecos");
    expect(m.description).toBe(`Veja 42 anúncios abertos de pedreiro em Sorocaba. ${PITCH}`);
    expect(m.robots).toBeNull();
  });

  it("n = 1 is singular", () => {
    expect(meta("Pedreiro", 1, "sorocaba").description).toBe(
      `Veja 1 anúncio aberto de pedreiro em Sorocaba. ${PITCH}`,
    );
  });

  it("n = 2 and n = 0 use the text without a number", () => {
    const text = `Encontre pedreiro em Sorocaba ou ache vagas. ${PITCH}`;
    expect(meta("Pedreiro", 2, "sorocaba").description).toBe(text);
    const empty = meta("Pedreiro", 0, "sorocaba");
    expect(empty.description).toBe(text);
    expect(empty.robots).toBe("noindex,nofollow");
  });

  it("profession page without city", () => {
    const many = meta("Pintor", 3);
    expect(many.title).toBe("Pintor: profissionais e vagas perto de você | Beecos");
    expect(many.description).toBe(`Veja 3 anúncios abertos de pintor perto de você. ${PITCH}`);
    expect(many.canonical).toBe("https://beecos.com.br/servicos/x");
    expect(meta("Pintor", 2).description).toBe(
      `Encontre pintor perto de você ou ache vagas. ${PITCH}`,
    );
  });

  it("long names drop the suffix and then the tagline to stay within 60 characters", () => {
    const long = meta("Freteiro e motorista de mudança", 5, "sorocaba");
    expect(long.title).toBe("Freteiro e motorista de mudança em Sorocaba");
    expect(long.description).toBe(
      `Veja 5 anúncios abertos de freteiro e motorista de mudança em Sorocaba. ${PITCH}`,
    );
    expect(meta("Freteiro e motorista de mudança", 5).title).toBe("Freteiro e motorista de mudança");
    expect(serviceTitle("Servente e ajudante de obra", "Sorocaba")).toBe(
      "Servente e ajudante de obra em Sorocaba",
    );
    // Sem " | Beecos" já cabe: fica sem o sufixo, mas com o texto.
    expect(serviceTitle("Eletricista", "Itaquaquecetuba")).toBe(
      "Eletricista em Itaquaquecetuba: profissionais e vagas",
    );
    for (const name of ["Freteiro e motorista de mudança", "Servente e ajudante de obra", "Cuidador(a) de idosos"]) {
      for (const city of [undefined, "Itaquaquecetuba", "São José dos Campos"]) {
        expect([...serviceTitle(name, city)].length).toBeLessThanOrEqual(60);
      }
    }
  });

  it("names with (a) keep their format, without extra spaces", () => {
    const m = meta("Cuidador(a)  de idosos ", 1, "sorocaba");
    expect(m.title).toBe("Cuidador(a) de idosos em Sorocaba: profissionais e vagas");
    expect(m.description).toBe(`Veja 1 anúncio aberto de cuidador(a) de idosos em Sorocaba. ${PITCH}`);
    const p = meta("Cuidador(a) de idosos", 0);
    expect(p.title).toBe("Cuidador(a) de idosos: profissionais e vagas perto de você");
    expect(p.description).toBe(`Encontre cuidador(a) de idosos perto de você ou ache vagas. ${PITCH}`);
  });

  it("og tags use the same title and description; unknown profession unchanged", () => {
    const missing = servicePageMeta(buildServicePage(null, [], "sorocaba", NOW), {
      profissao: "nada",
      cidade: "sorocaba",
    });
    expect(missing.title).toBe("Serviço não encontrado | Beecos");
    expect(missing.robots).toBe("noindex,nofollow");
  });
});
