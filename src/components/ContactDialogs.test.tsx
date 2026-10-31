import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressDialog, EmailDialog, PersonalDialog, PhoneDialog } from "./ContactDialogs";

afterEach(cleanup);

describe("PhoneDialog", () => {
  function setup() {
    const onSave = vi.fn(async () => true);
    const onOpenChange = vi.fn();
    render(<PhoneDialog open onOpenChange={onOpenChange} initial={null} onSave={onSave} />);
    return { onSave, onOpenChange };
  }
  it("rejects an invalid number and a missing method", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "123" } });
    fireEvent.click(screen.getByLabelText("Ligação")); // desmarca o padrão
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Digite um telefone válido, com DDD.")).toBeTruthy();
    expect(screen.getByText("Marque pelo menos uma forma de contato.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("saves kind, number and methods", async () => {
    const { onSave, onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "work" } });
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: " (11) 98818-2720 " } });
    fireEvent.click(screen.getByLabelText("WhatsApp"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      kind: "work",
      number: "(11) 98818-2720",
      methods: ["call", "whatsapp"],
      shared: true,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
  it("lets the person keep the number private", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "11988182720" } });
    fireEvent.click(screen.getByLabelText(/Mostrar para quem conversa comigo/));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ shared: false })),
    );
  });
});

describe("AddressDialog", () => {
  it("asks for the required fields, then saves the CEP as digits", async () => {
    const onSave = vi.fn(async () => true);
    render(
      <AddressDialog open onOpenChange={() => {}} kind="physical" initial={null} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Escreva o destinatário.")).toBeTruthy();
    expect(screen.getByText("Escolha o estado.")).toBeTruthy();
    expect(screen.getByText("O CEP tem 8 números.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Destinatário"), { target: { value: "Bruno" } });
    fireEvent.change(screen.getByLabelText("Rua e número"), {
      target: { value: "R. Benjamin Pinto, 269" },
    });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "Sorocaba" } });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "SP" } });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "07272-720" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      kind: "physical",
      recipient: "Bruno",
      care_of: "",
      street: "R. Benjamin Pinto, 269",
      neighborhood: "",
      city: "Sorocaba",
      state: "SP",
      postal_code: "07272720",
    });
  });
});

describe("PersonalDialog", () => {
  const initial = {
    last_name: "",
    first_name: "",
    other_names: "",
    name_suffix: "",
    preferred_name: "Bruno",
    birth_date: "",
  };
  it("blocks an empty preferred name and a future birth date", async () => {
    const onSave = vi.fn(async () => true);
    render(<PersonalDialog open onOpenChange={() => {}} initial={initial} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Nome preferido"), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "2999-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Escreva como quer ser chamado.")).toBeTruthy();
    expect(screen.getByText("Data de nascimento inválida.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("saves trimmed values", async () => {
    const onSave = vi.fn(async () => true);
    render(<PersonalDialog open onOpenChange={() => {}} initial={initial} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Primeiro nome"), { target: { value: " Bruno " } });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "1990-05-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Bruno",
        preferred_name: "Bruno",
        birth_date: "1990-05-01",
      }),
    );
  });
});

describe("EmailDialog", () => {
  it("rejects invalid or unchanged e-mail", async () => {
    const onSave = vi.fn(async () => true);
    render(<EmailDialog open onOpenChange={() => {}} current="a@b.com" onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Novo e-mail"), { target: { value: "xx" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar confirmação" }));
    expect(await screen.findByText("Digite um e-mail válido.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Novo e-mail"), { target: { value: "A@B.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar confirmação" }));
    expect(await screen.findByText("Esse já é o e-mail da conta.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("sends a new e-mail", async () => {
    const onSave = vi.fn(async () => true);
    render(<EmailDialog open onOpenChange={() => {}} current="a@b.com" onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Novo e-mail"), { target: { value: "novo@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar confirmação" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("novo@b.com"));
  });
});
