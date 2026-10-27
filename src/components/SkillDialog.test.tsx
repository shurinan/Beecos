import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillDialog } from "./SkillDialog";
import type { ProfileSkill, SkillInput } from "@/lib/skills";

afterEach(cleanup);

function setup(over: { initial?: ProfileSkill | null; existing?: string[] } = {}) {
  const onSave = vi.fn(async (_s: SkillInput) => true);
  const onOpenChange = vi.fn();
  render(
    <SkillDialog
      open
      onOpenChange={onOpenChange}
      initial={over.initial ?? null}
      existing={over.existing ?? []}
      onSave={onSave}
    />,
  );
  return { onSave, onOpenChange };
}

const submit = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /^(Adicionar habilidade|Salvar alterações)$/ }),
  );

describe("SkillDialog", () => {
  it("shows the fields from the skill form", () => {
    setup();
    expect(screen.getByLabelText("Habilidade")).toBeTruthy();
    expect(screen.getByText("Nível de competência")).toBeTruthy();
    for (const label of ["Quase profissional", "Profissional", "Especialista"]) {
      expect(screen.getByLabelText(new RegExp(label))).toBeTruthy();
    }
    expect(screen.getByText("Você pode treinar outros")).toBeTruthy();
    expect(
      screen.getByText("Você tem experiência profissional usando essa habilidade?"),
    ).toBeTruthy();
    expect(screen.getByText("Licenciado/certificado")).toBeTruthy();
    expect(screen.getByLabelText("Outras informações")).toBeTruthy();
  });

  it("asks for every required answer before saving", async () => {
    const { onSave } = setup();
    submit();
    expect(await screen.findByText("Escreva o nome da habilidade")).toBeTruthy();
    expect(screen.getByText("Escolha o seu nível")).toBeTruthy();
    expect(screen.getAllByText("Responda sim ou não")).toHaveLength(3);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the answers and closes", async () => {
    const { onSave, onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText("Habilidade"), { target: { value: "  Pedreiro " } });
    fireEvent.click(screen.getByLabelText(/Profissional/));
    const yes = screen.getAllByLabelText("Sim");
    const no = screen.getAllByLabelText("Não");
    fireEvent.click(yes[0]!); // experiência
    fireEvent.click(no[1]!); // treinamento
    fireEvent.click(yes[2]!); // certificado
    fireEvent.change(screen.getByLabelText("Outras informações"), {
      target: { value: "Aprendi em obra" },
    });
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      skill: "Pedreiro",
      level: 2,
      has_experience: true,
      years_experience: null,
      had_training: false,
      certified: true,
      notes: "Aprendi em obra",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("blocks a duplicate name ignoring case and accents", async () => {
    const { onSave } = setup({ existing: ["Elétrica"] });
    fireEvent.change(screen.getByLabelText("Habilidade"), { target: { value: "eletrica" } });
    submit();
    expect(await screen.findByText("Você já adicionou essa habilidade")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the dialog open when saving fails", async () => {
    const onSave = vi.fn(async () => false);
    const onOpenChange = vi.fn();
    render(
      <SkillDialog open onOpenChange={onOpenChange} initial={null} existing={[]} onSave={onSave} />,
    );
    fireEvent.change(screen.getByLabelText("Habilidade"), { target: { value: "Pintura" } });
    fireEvent.click(screen.getByLabelText(/Especialista/));
    fireEvent.click(screen.getAllByLabelText("Sim")[0]!);
    fireEvent.click(screen.getAllByLabelText("Sim")[1]!);
    fireEvent.click(screen.getAllByLabelText("Não")[2]!);
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("asks for the years only after answering yes, and sends them", async () => {
    const { onSave } = setup();
    expect(screen.queryByLabelText(/Há quantos anos/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Habilidade"), { target: { value: "Elétrica" } });
    fireEvent.click(screen.getByLabelText(/Profissional/));
    fireEvent.click(screen.getAllByLabelText("Sim")[0]!);
    fireEvent.change(screen.getByLabelText(/Há quantos anos/), { target: { value: "4" } });
    fireEvent.click(screen.getAllByLabelText("Sim")[1]!);
    fireEvent.click(screen.getAllByLabelText("Sim")[2]!);
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      has_experience: true,
      years_experience: 4,
      had_training: true,
      certified: true,
    });
  });

  it("rejects invalid years and drops them when experience is no", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText("Habilidade"), { target: { value: "Pintura" } });
    fireEvent.click(screen.getByLabelText(/Especialista/));
    fireEvent.click(screen.getAllByLabelText("Sim")[0]!);
    fireEvent.change(screen.getByLabelText(/Há quantos anos/), { target: { value: "99" } });
    fireEvent.click(screen.getAllByLabelText("Não")[1]!);
    fireEvent.click(screen.getAllByLabelText("Não")[2]!);
    submit();
    expect(await screen.findByText("Use um número inteiro de 0 a 60")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByLabelText("Não")[0]!);
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      has_experience: false,
      years_experience: null,
    });
  });

  it("prefills when editing and locks the name", () => {
    setup({
      initial: {
        skill: "Pintura",
        level: 3,
        has_experience: true,
        years_experience: 4,
        had_training: false,
        certified: false,
        notes: "x",
        updated_at: "2026-10-21T15:00:00Z",
      },
      existing: ["Pintura"],
    });
    const name = screen.getByLabelText("Habilidade") as HTMLInputElement;
    expect(name.value).toBe("Pintura");
    expect(name.readOnly).toBe(true);
    expect((screen.getByLabelText(/Especialista/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeTruthy();
  });
});
