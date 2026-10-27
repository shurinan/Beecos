import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillDialog } from "./SkillDialog";
import type { ProfileSkill } from "@/lib/skills";

afterEach(cleanup);

function setup(over: { initial?: ProfileSkill | null; existing?: string[] } = {}) {
  const onSave = vi.fn(async (_s: ProfileSkill) => true);
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

  it("prefills when editing and locks the name", () => {
    setup({
      initial: {
        skill: "Pintura",
        level: 3,
        has_experience: true,
        had_training: false,
        certified: false,
        notes: "x",
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
