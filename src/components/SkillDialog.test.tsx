import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillDialog } from "./SkillDialog";
import { buildCatalog } from "@/lib/catalog";
import type { ProfileSkill, SkillInput } from "@/lib/skills";

afterEach(cleanup);

const catalog = buildCatalog(
  [{ id: "s1", name: "Construção civil", sort: 0, active: true }],
  [
    {
      id: "p-ele",
      sector_id: "s1",
      name: "Eletricista",
      aliases: ["fiação"],
      sort: 0,
      active: true,
    },
    { id: "p-ped", sector_id: "s1", name: "Pedreiro", aliases: [], sort: 1, active: true },
    { id: "p-enc", sector_id: "s1", name: "Encanador", aliases: [], sort: 2, active: true },
  ],
  [
    {
      id: "v-chu",
      profession_id: "p-ele",
      name: "Instalação de chuveiro",
      aliases: ["chuveiro"],
      sort: 0,
      active: true,
    },
    {
      id: "v-tom",
      profession_id: "p-ele",
      name: "Troca de tomadas",
      aliases: [],
      sort: 1,
      active: true,
    },
  ],
);

function setup(over: { initial?: ProfileSkill | null; existing?: string[] } = {}) {
  const onSave = vi.fn(async (_s: SkillInput) => true);
  const onOpenChange = vi.fn();
  render(
    <SkillDialog
      open
      onOpenChange={onOpenChange}
      initial={over.initial ?? null}
      existing={over.existing ?? []}
      catalog={catalog}
      onSave={onSave}
    />,
  );
  return { onSave, onOpenChange };
}

const submit = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /^(Adicionar habilidade|Salvar alterações)$/ }),
  );

const choose = (id: string) =>
  fireEvent.change(screen.getByLabelText("Ou escolha na lista"), { target: { value: id } });

/** Responde às três perguntas Sim/Não: experiência, treinamento e certificado. */
function answer(exp: boolean, training: boolean, cert: boolean) {
  const pick = (label: "Sim" | "Não", i: number) =>
    fireEvent.click(screen.getAllByLabelText(label)[i]!);
  // a cada resposta "Sim" em experiência aparece um campo extra, mas os rádios seguem na mesma ordem
  pick(exp ? "Sim" : "Não", 0);
  pick(training ? "Sim" : "Não", 1);
  pick(cert ? "Sim" : "Não", 2);
}

describe("SkillDialog", () => {
  it("shows the profession picker and the skill form fields", () => {
    setup();
    expect(screen.getByLabelText("Profissão")).toBeTruthy();
    expect(screen.getByLabelText("Ou escolha na lista")).toBeTruthy();
    expect(screen.getByText("Nível de competência")).toBeTruthy();
    for (const label of ["Quase profissional", "Profissional", "Especialista"]) {
      expect(screen.getByLabelText(new RegExp(label))).toBeTruthy();
    }
    expect(screen.getByText("Licenciado/certificado")).toBeTruthy();
    expect(screen.getByLabelText("Outras informações")).toBeTruthy();
    expect(screen.queryByLabelText("Qual é a habilidade?")).toBeNull();
  });

  it("asks for every required answer before saving", async () => {
    const { onSave } = setup();
    submit();
    expect(await screen.findByText("Escolha a profissão")).toBeTruthy();
    expect(screen.getByText("Escolha o seu nível")).toBeTruthy();
    expect(screen.getAllByText("Responda sim ou não")).toHaveLength(3);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("lists the services of the chosen profession and saves them", async () => {
    const { onSave, onOpenChange } = setup();
    expect(screen.queryByLabelText("Instalação de chuveiro")).toBeNull();
    choose("p-ele");
    fireEvent.click(screen.getByLabelText("Instalação de chuveiro"));
    fireEvent.click(screen.getByLabelText("Troca de tomadas"));
    fireEvent.click(screen.getByLabelText("Troca de tomadas")); // desmarca
    fireEvent.click(screen.getByLabelText(/Profissional/));
    answer(true, false, true);
    fireEvent.change(screen.getByLabelText("Outras informações"), {
      target: { value: "Aprendi em obra" },
    });
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      skill: "Eletricista",
      profession_id: "p-ele",
      service_ids: ["v-chu"],
      level: 2,
      has_experience: true,
      years_experience: null,
      had_training: false,
      certified: true,
      notes: "Aprendi em obra",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("finds a profession or service by nickname and picks it", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText("Profissão"), { target: { value: "chuveiro" } });
    fireEvent.click(screen.getByRole("button", { name: /Instalação de chuveiro/ }));
    expect((screen.getByLabelText("Instalação de chuveiro") as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByLabelText(/Especialista/));
    answer(false, false, false);
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      profession_id: "p-ele",
      service_ids: ["v-chu"],
    });
  });

  it("accepts 'Outro' with a name of the person's own", async () => {
    const { onSave } = setup();
    choose("__other__");
    expect(screen.queryByText("Quais serviços você faz?")).toBeNull();
    submit();
    expect(await screen.findByText("Escreva o nome da habilidade")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Qual é a habilidade?"), {
      target: { value: "  Instalador de toldos " },
    });
    fireEvent.click(screen.getByLabelText(/Especialista/));
    answer(false, false, false);
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      skill: "Instalador de toldos",
      profession_id: null,
      service_ids: [],
    });
  });

  it("blocks a profession already added, ignoring case and accents", async () => {
    const { onSave } = setup({ existing: ["ELETRICISTA"] });
    choose("p-ele");
    submit();
    expect(await screen.findByText("Você já adicionou essa habilidade")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the dialog open when saving fails", async () => {
    const onSave = vi.fn(async () => false);
    const onOpenChange = vi.fn();
    render(
      <SkillDialog
        open
        onOpenChange={onOpenChange}
        initial={null}
        existing={[]}
        catalog={catalog}
        onSave={onSave}
      />,
    );
    choose("p-ped");
    fireEvent.click(screen.getByLabelText(/Especialista/));
    answer(true, true, false);
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("asks for the years only after answering yes, and sends them", async () => {
    const { onSave } = setup();
    expect(screen.queryByLabelText(/Há quantos anos/)).toBeNull();
    choose("p-ele");
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
    choose("p-ped");
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

  it("prefills when editing, locks the profession and keeps the services editable", async () => {
    const { onSave } = setup({
      initial: {
        skill: "Eletricista",
        profession_id: "p-ele",
        service_ids: ["v-chu"],
        level: 3,
        has_experience: true,
        years_experience: 4,
        had_training: false,
        certified: false,
        notes: "x",
        updated_at: "2026-10-21T15:00:00Z",
      },
      existing: ["Eletricista"],
    });
    expect(screen.queryByLabelText("Ou escolha na lista")).toBeNull();
    expect(screen.getByText("Eletricista")).toBeTruthy();
    expect((screen.getByLabelText(/Especialista/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Instalação de chuveiro") as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByLabelText("Troca de tomadas"));
    submit();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      skill: "Eletricista",
      profession_id: "p-ele",
      service_ids: ["v-chu", "v-tom"],
    });
  });
});
