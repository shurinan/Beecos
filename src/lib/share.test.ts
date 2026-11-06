import { describe, expect, it } from "vitest";
import { postPreview, postShareText, postShareUrl } from "./share";

const job = {
  kind: "job",
  title: "Instalar chuveiro",
  city: "Centro",
  price: "R$ 150",
  slug: "instalar-chuveiro-ab12",
};
const ad = {
  kind: "available",
  title: "Declaração imposto de renda",
  city: "Itaquaquecetuba - SP",
  price: "R$ 95",
  slug: "irpf-cd34",
};

describe("share", () => {
  it("makes a public link", () => {
    expect(postShareUrl("irpf-cd34")).toBe("https://beecos.com.br/v/irpf-cd34");
  });
  it("speaks in first person for the owner", () => {
    expect(postShareText(job, true)).toBe(
      "Estou contratando: Instalar chuveiro em Centro (R$ 150). Veja os detalhes e fale comigo pelo Beecos: https://beecos.com.br/v/instalar-chuveiro-ab12",
    );
    expect(postShareText(ad, true)).toMatch(
      /^Ofereço Declaração imposto de renda em Itaquaquecetuba - SP \(R\$ 95\)\. Veja meu anúncio/,
    );
    expect(postShareText(job, false)).toMatch(/^Olha essa vaga no Beecos/);
  });
  it("builds the link preview", () => {
    expect(postPreview({ ...job, description: "Chuveiro  queimou" })).toEqual({
      title: "Vaga: Instalar chuveiro — Centro",
      description: "R$ 150 · Chuveiro queimou",
    });
    expect(postPreview({ ...ad, description: "x".repeat(200) }).description.length).toBeLessThan(
      170,
    );
  });
});
