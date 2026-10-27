import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertPrefsCard } from "@/components/AlertPrefsCard";
import { DEFAULT_PREFS } from "@/lib/alerts";

describe("AlertPrefsCard", () => {
  it("turns notifications off", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AlertPrefsCard prefs={DEFAULT_PREFS} onSave={onSave} />);
    fireEvent.click(screen.getByRole("switch", { name: "Receber avisos de vagas" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ in_app: false }));
  });
  it("pauses for 7 days", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AlertPrefsCard prefs={DEFAULT_PREFS} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(typeof onSave.mock.calls[0]![0].paused_until).toBe("string");
  });
  it("resumes when paused and hides pause choices", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const until = new Date(Date.now() + 86_400_000).toISOString();
    render(<AlertPrefsCard prefs={{ ...DEFAULT_PREFS, paused_until: until }} onSave={onSave} />);
    expect(screen.queryByRole("button", { name: "7 dias" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar a receber agora" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ paused_until: null }));
  });
  it("hides the pause when off", () => {
    render(<AlertPrefsCard prefs={{ ...DEFAULT_PREFS, in_app: false }} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "1 dia" })).toBeNull();
  });
});
