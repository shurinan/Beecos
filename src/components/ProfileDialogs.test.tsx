import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditProfileDialog, type ProfileFields } from "./ProfileDialogs";
import { SkillCard } from "./profile-bits";

afterEach(cleanup);

const profile: ProfileFields = {
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
