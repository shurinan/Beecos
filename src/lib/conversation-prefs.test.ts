import { describe, expect, it } from "vitest";
import { arrangeInbox, NO_PREF, reminderDue, type ConvPref } from "./conversation-prefs";

const row = (id: string, at: string) => ({ id, last_message_at: at });
const pref = (id: string, p: Partial<ConvPref>): [string, ConvPref] => [
  id,
  { ...NO_PREF, conversation_id: id, ...p },
];

describe("lista de conversas", () => {
  const rows = [row("a", "2026-10-01"), row("b", "2026-10-03"), row("c", "2026-10-02")];
  it("mais recente primeiro", () => {
    expect(arrangeInbox(rows, new Map(), "todas").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
  it("fixadas sobem, na ordem em que foram fixadas", () => {
    const prefs = new Map([
      pref("a", { pinned_at: "2026-10-05" }),
      pref("c", { pinned_at: "2026-10-04" }),
    ]);
    expect(arrangeInbox(rows, prefs, "todas").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
  it("arquivadas saem da lista e aparecem na aba delas", () => {
    const prefs = new Map([pref("b", { archived: true })]);
    expect(arrangeInbox(rows, prefs, "todas").map((r) => r.id)).toEqual(["c", "a"]);
    expect(arrangeInbox(rows, prefs, "arquivadas").map((r) => r.id)).toEqual(["b"]);
  });
  it("favoritas", () => {
    const prefs = new Map([pref("a", { favorite: true })]);
    expect(arrangeInbox(rows, prefs, "favoritas").map((r) => r.id)).toEqual(["a"]);
  });
  it("excluída some até chegar mensagem nova", () => {
    const prefs = new Map([pref("b", { cleared_at: "2026-10-03" })]);
    expect(arrangeInbox(rows, prefs, "todas").map((r) => r.id)).toEqual(["c", "a"]);
    const again = [row("b", "2026-10-04"), ...rows.slice(0, 1)];
    expect(arrangeInbox(again, prefs, "todas").map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("lembrete vencido", () => {
    expect(reminderDue("2026-10-01T00:00:00Z", Date.parse("2026-10-02"))).toBe(true);
    expect(reminderDue("2026-10-03T00:00:00Z", Date.parse("2026-10-02"))).toBe(false);
    expect(reminderDue(null)).toBe(false);
  });
});
