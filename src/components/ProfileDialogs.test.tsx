import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditProfileDialog, type ProfileFields } from "./ProfileDialogs";
import { SkillCard } from "./profile-bits";

afterEach(cleanup);

const profile: ProfileFields = {
  username: "bruno",
  full_name: "Bruno Espíndola",
  headline: "Eletricista residencial",
  city: "Sorocaba - SP",
  service_area: "",
  certificate_note: "",
  bio: "",
  available: false,
};

describe("EditProfileDialog", () => {
  it("requires a name", async () => {
    const onSave = vi.fn(async () => true);
    render(
      <EditProfileDialog
        open
        onOpenChange={() => {}}
        initial={{ ...profile, full_name: "" }}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Escreva o seu nome")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves trimmed values and closes", async () => {
    const onSave = vi.fn(async (_v: ProfileFields) => true);
    const onOpenChange = vi.fn();
    render(
      <EditProfileDialog open onOpenChange={onOpenChange} initial={profile} onSave={onSave} />,
    );
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "  Itu - SP  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      full_name: "Bruno Espíndola",
      city: "Itu - SP",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("SkillCard", () => {
  const base = {
    skill: "Elétrica/Eletricista residencial",
    profession_id: null,
    service_ids: [],
    level: 2,
    has_experience: true,
    years_experience: 1,
    had_training: true,
    certified: true,
    notes: "Aprendi no SENAI",
    updated_at: "2026-10-21T15:00:00Z",
  };

  it("shows the four fields from the overview", () => {
    render(<SkillCard skill={base} />);
    expect(screen.getByText("Elétrica/Eletricista residencial")).toBeTruthy();
    expect(screen.getByText("Anos de experiência").nextSibling?.textContent).toBe("1 ano");
    expect(screen.getByText("Nível de competência").nextSibling?.textContent).toBe("Profissional");
    expect(screen.getByText("Licenciado/certificado").nextSibling?.textContent).toBe("Sim");
    expect(screen.getByText("Atualizado em").nextSibling?.textContent).toBe(
      "21 de outubro de 2026",
    );
    expect(screen.getByText("Fez treinamento ou aulas")).toBeTruthy();
    expect(screen.getByText("Aprendi no SENAI")).toBeTruthy();
  });

  it("lists the services the person does", () => {
    render(<SkillCard skill={base} services={["Instalação de chuveiro", "Troca de tomadas"]} />);
    expect(screen.getByText(/Instalação de chuveiro, Troca de tomadas/)).toBeTruthy();
  });

  it("shows a dash for years without professional experience and 'Não' when not certified", () => {
    render(
      <SkillCard
        skill={{
          ...base,
          has_experience: false,
          years_experience: null,
          certified: false,
          had_training: false,
        }}
      />,
    );
    expect(screen.getByText("Anos de experiência").nextSibling?.textContent).toBe("—");
    expect(screen.getByText("Licenciado/certificado").nextSibling?.textContent).toBe("Não");
    expect(screen.queryByText("Fez treinamento ou aulas")).toBeNull();
  });
});

describe("EditProfileDialog username", () => {
  it("normalizes while typing and shows when it is free", async () => {
    const check = vi.fn(async () => true);
    render(
      <EditProfileDialog
        open
        onOpenChange={() => {}}
        initial={{ ...profile, username: "" }}
        onSave={vi.fn(async () => true)}
        checkUsername={check}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "@Bruno.S" } });
    expect((screen.getByLabelText("Nome de usuário") as HTMLInputElement).value).toBe("bruno.s");
    expect(await screen.findByText("Disponível ✓")).toBeTruthy();
    expect(check).toHaveBeenCalledWith("bruno.s");
  });
  it("blocks saving a taken username", async () => {
    const onSave = vi.fn(async () => true);
    render(
      <EditProfileDialog
        open
        onOpenChange={() => {}}
        initial={profile}
        onSave={onSave}
        checkUsername={async () => false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "ocupado" } });
    expect(await screen.findByText("Esse nome de usuário já está em uso.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("rejects a bad format without asking the database", async () => {
    const check = vi.fn(async () => true);
    render(
      <EditProfileDialog
        open
        onOpenChange={() => {}}
        initial={profile}
        onSave={vi.fn(async () => true)}
        checkUsername={check}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nome de usuário"), { target: { value: "ab" } });
    expect(await screen.findByText(/De 3 a 30 caracteres/)).toBeTruthy();
    expect(check).not.toHaveBeenCalled();
  });
  it("lets the person keep an unchanged username without checking", async () => {
    const check = vi.fn(async () => false);
    const onSave = vi.fn(async (_v: ProfileFields) => true);
    render(
      <EditProfileDialog
        open
        onOpenChange={() => {}}
        initial={profile}
        onSave={onSave}
        checkUsername={check}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(check).not.toHaveBeenCalled();
  });
});
