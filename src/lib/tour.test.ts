import { describe, expect, it } from "vitest";
import { DESKTOP_STEPS, MOBILE_STEPS, placeTip, shouldAutoStart } from "./tour";

describe("tutorial", () => {
  it("abre sozinho só para conta nova que ainda não viu", () => {
    expect(shouldAutoStart({ id: "a", created_at: "2026-11-08T10:00:00Z" })).toBe(true);
    expect(shouldAutoStart({ id: "b", created_at: "2026-10-01T10:00:00Z" })).toBe(false);
    expect(
      shouldAutoStart({
        id: "c",
        created_at: "2026-11-08T10:00:00Z",
        user_metadata: { tour_visto: true },
      }),
    ).toBe(false);
    expect(shouldAutoStart(null)).toBe(false);
  });

  it("roteiros de 9 passos terminando no Pronto", () => {
    expect(MOBILE_STEPS).toHaveLength(9);
    expect(DESKTOP_STEPS).toHaveLength(9);
    expect(MOBILE_STEPS.at(-1)?.target).toBeUndefined();
    expect(DESKTOP_STEPS.at(-1)?.target).toBeUndefined();
  });

  it("balão embaixo de botão no topo e em cima de botão embaixo, sem sair da tela", () => {
    const view = { width: 360, height: 740 };
    const top = placeTip({ top: 8, bottom: 44, left: 310, width: 36 }, view, 336);
    expect(top.top).toBe(60);
    expect(top.left).toBe(12);
    const bottom = placeTip({ top: 680, bottom: 730, left: 10, width: 60 }, view, 336);
    expect(bottom.bottom).toBe(740 - 680 + 16);
    expect(bottom.top).toBeUndefined();
  });
});
