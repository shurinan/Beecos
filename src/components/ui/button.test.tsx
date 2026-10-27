import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("grows instead of overflowing when the label is long", () => {
    render(<Button>Escolher este prestador</Button>);
    const cls = screen.getByRole("button").className;
    expect(cls).not.toContain("whitespace-nowrap");
    expect(cls).toContain("max-w-full");
    expect(cls).toContain("min-h-9");
    expect(cls).toContain("pointer-coarse:min-h-11"); // 44 px em tela de toque
  });
  it("shows loading: disabled, busy and no clicks", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
  it("is not busy by default and still clickable", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ok</Button>);
    const b = screen.getByRole("button", { name: "Ok" });
    expect(b.getAttribute("aria-busy")).toBeNull();
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("renders the child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/x">Ir</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Ir" }).className).toContain("touch-manipulation");
  });
});
