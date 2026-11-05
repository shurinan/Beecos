import { beforeEach, describe, expect, it } from "vitest";
import { SOUND_KEY, playNotificationSound, setSoundEnabled, soundEnabled } from "@/lib/sound";

describe("som de notificação", () => {
  beforeEach(() => localStorage.clear());

  it("vem ligado e pode ser desligado neste aparelho", () => {
    expect(soundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(localStorage.getItem(SOUND_KEY)).toBe("off");
    expect(soundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(soundEnabled()).toBe(true);
  });

  it("não quebra quando o aparelho não tem som", () => {
    expect(() => playNotificationSound()).not.toThrow();
  });
});
