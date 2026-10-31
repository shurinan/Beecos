import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Seal, SealDetails, ringStyle } from "./Seal";

describe("Seal", () => {
  it("dourado é uma estrela de 12 pontas (24 vértices)", () => {
    const { container } = render(<Seal tier="both" />);
    const pts = container.querySelector("polygon")?.getAttribute("points")?.split(" ") ?? [];
    expect(pts).toHaveLength(24);
  });
  it("azul e prata são redondos", () => {
    for (const tier of ["verified", "premium"] as const) {
      const { container } = render(<Seal tier={tier} />);
      expect(container.querySelector("polygon")).toBeNull();
      expect(container.querySelectorAll("circle").length).toBe(2);
    }
  });
});

describe("ringStyle", () => {
  it("só Premium e Premium+Verificado têm anel", () => {
    expect(ringStyle("verified")).toEqual({});
    expect(ringStyle(null)).toEqual({});
    expect(ringStyle("premium").boxShadow).toBeTruthy();
    expect(ringStyle("both").boxShadow?.match(/#E0A800/g)).toHaveLength(2);
  });
});

describe("SealDetails", () => {
  it("lista os três itens e marca o que não foi conferido", () => {
    const { getByText, getAllByText } = render(
      <SealDetails
        tier="verified"
        info={{ premium: false, doc: true, email: true, phone: false }}
      />,
    );
    for (const l of ["Identidade", "E-mail", "Telefone"]) expect(getByText(l)).toBeTruthy();
    expect(getAllByText("não conferido")).toHaveLength(1);
  });
});
