import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkAreaDialog } from "./WorkAreaDialog";
import { GeoError, type Place } from "@/lib/geo";

afterEach(cleanup);

const osasco: Place = { cep: "06010000", city: "Osasco", state: "SP", lat: -23.53, lng: -46.79 };

function setup(
  over: {
    premium?: boolean;
    initial?: { postal_code: string; city: string; state: string; expanded_km: number } | null;
    lookup?: (cep: string) => Promise<Place>;
  } = {},
) {
  const onSave = vi.fn(async () => true);
  const onOpenChange = vi.fn();
  const onUpgrade = vi.fn();
  const lookup = over.lookup ?? vi.fn(async () => osasco);
  render(
    <WorkAreaDialog
      open
      onOpenChange={onOpenChange}
      initial={over.initial ?? null}
      premium={over.premium ?? false}
      onSave={onSave}
      onUpgrade={onUpgrade}
      lookup={lookup}
    />,
  );
  return { onSave, onOpenChange, onUpgrade, lookup };
}

const typeCep = (v: string) =>
  fireEvent.change(screen.getByLabelText(/CEP de onde/), { target: { value: v } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

describe("WorkAreaDialog", () => {
  it("explains the 20 km radius and locks the expanded one for the free plan", () => {
    const { onUpgrade } = setup();
    expect(screen.getByText(/Vale para todos os planos/)).toBeTruthy();
    expect((screen.getByLabelText(/Raio expandido/) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/continua vendo todas no feed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quero ser Premium" }));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("looks up the CEP as soon as it is complete and saves the place", async () => {
    const { onSave, onOpenChange, lookup } = setup();
    typeCep("06010000");
    expect(await screen.findByText("Osasco - SP")).toBeTruthy();
    expect(lookup).toHaveBeenCalledWith(
      "06.010-000".replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2"),
    );
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...osasco, expanded_km: 0 }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("lets Premium pick an expanded radius", async () => {
    const { onSave } = setup({ premium: true });
    typeCep("06010-000");
    await screen.findByText("Osasco - SP");
    fireEvent.change(screen.getByLabelText(/Raio expandido/), { target: { value: "10" } });
    expect(screen.getByText(/aviso de vagas até 30 km/)).toBeTruthy();
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...osasco, expanded_km: 10 }));
  });

  it("shows the problem and does not save when the CEP cannot be found", async () => {
    const lookup = vi.fn(async () => {
      throw new GeoError("CEP não encontrado. Confira os números.");
    });
    const { onSave } = setup({ lookup });
    typeCep("99999999");
    expect(await screen.findByText("CEP não encontrado. Confira os números.")).toBeTruthy();
    save();
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("asks for the 8 digits before saving", async () => {
    const { onSave } = setup();
    typeCep("0601");
    save();
    expect(await screen.findByText("Digite o CEP com 8 números.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps working when only the radius changes on a saved CEP", async () => {
    const { onSave } = setup({
      premium: true,
      initial: { postal_code: "06010000", city: "Osasco", state: "SP", expanded_km: 5 },
    });
    expect(screen.getByText("Osasco - SP")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Raio expandido/), { target: { value: "20" } });
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...osasco, expanded_km: 20 }));
  });

  it("forces the radius to 0 when the plan is free, even with an old saved value", async () => {
    const { onSave } = setup({
      premium: false,
      initial: { postal_code: "06010000", city: "Osasco", state: "SP", expanded_km: 10 },
    });
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...osasco, expanded_km: 0 }));
  });
});
