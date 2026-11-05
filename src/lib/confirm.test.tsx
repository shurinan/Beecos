import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmHost } from "@/components/ConfirmHost";
import { confirmAction } from "./confirm";

afterEach(cleanup);

describe("confirmAction", () => {
  it("asks and resolves true when the person confirms", async () => {
    render(<ConfirmHost />);
    const answer = confirmAction({
      title: "Tem certeza que deseja excluir esta vaga?",
      confirmLabel: "Excluir",
    });
    expect(await screen.findByText("Tem certeza que deseja excluir esta vaga?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await expect(answer).resolves.toBe(true);
  });

  it("resolves false when the person goes back", async () => {
    render(<ConfirmHost />);
    const answer = confirmAction({ title: "Tem certeza que deseja sair?", confirmLabel: "Sair" });
    fireEvent.click(await screen.findByRole("button", { name: "Voltar" }));
    await expect(answer).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByText("Tem certeza que deseja sair?")).toBeNull());
  });
});
