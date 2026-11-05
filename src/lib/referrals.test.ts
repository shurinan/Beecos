import { afterEach, describe, expect, it } from "vitest";
import {
  clearInvite,
  inviteLink,
  inviteMessage,
  inviteeStep,
  peekInvite,
  saveInvite,
  whatsappShareUrl,
  type Invitee,
} from "./referrals";

afterEach(() => localStorage.clear());

describe("invite link and message", () => {
  it("uses the unique username", () => {
    expect(inviteLink("maria")).toBe("https://beecos.com.br/c/maria");
    expect(inviteMessage("maria")).toMatch(
      /^Você trabalha com serviço\?.*beecos\.com\.br\/c\/maria$/,
    );
    expect(whatsappShareUrl("maria")).toContain("https://wa.me/?text=");
  });
});

describe("stored invite", () => {
  it("keeps a valid username for 30 days", () => {
    saveInvite("Maria-Souza", 1000);
    expect(peekInvite(2000)).toBe("maria-souza");
    expect(peekInvite(1000 + 31 * 86400_000)).toBeNull();
    clearInvite();
    expect(peekInvite(2000)).toBeNull();
  });
  it("ignores invalid names", () => {
    saveInvite("<script>");
    expect(peekInvite()).toBeNull();
  });
});

describe("inviteeStep", () => {
  const p: Invitee = {
    name: "Ana",
    avatar_path: null,
    joined_at: "2026-11-01",
    email: true,
    skill: true,
    doc: false,
    counted: false,
    rewarded: false,
  };
  it("says what is missing, in order", () => {
    expect(inviteeStep({ ...p, email: false }).text).toBe("Falta confirmar o e-mail");
    expect(inviteeStep({ ...p, skill: false }).text).toBe("Falta 1 habilidade");
    expect(inviteeStep(p).text).toBe("Falta verificar identidade");
    expect(inviteeStep({ ...p, counted: true })).toEqual({ text: "Contou ✓", done: true });
  });
});
