import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  result: { data: null, error: null } as { data: unknown; error: unknown },
  calls: [] as unknown[][],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (...args: unknown[]) => {
      state.calls.push(args);
      return state.result;
    },
  },
}));

import { isUuid, openConversation } from "./data";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  state.result = { data: null, error: null };
  state.calls = [];
});

describe("isUuid", () => {
  it("accepts uuids and rejects everything else", () => {
    expect(isUuid(ME)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(`${OTHER},user_a.eq.x`)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("openConversation", () => {
  it("rejects ids that are not uuids before calling the server", async () => {
    await expect(openConversation(ME, "x),or(user_a.neq.0", null)).rejects.toThrow();
    await expect(openConversation(ME, OTHER, "bad")).rejects.toThrow();
    expect(state.calls).toHaveLength(0);
  });

  it("asks the server for the one conversation of the pair, with the post", async () => {
    state.result = { data: "c1", error: null };
    await expect(openConversation(ME, OTHER, POST)).resolves.toBe("c1");
    expect(state.calls).toEqual([["open_conversation", { _other: OTHER, _post: POST }]]);
  });

  it("omits the post when there is none", async () => {
    state.result = { data: "c1", error: null };
    await openConversation(ME, OTHER, null);
    expect(state.calls).toEqual([["open_conversation", { _other: OTHER }]]);
  });

  it("propagates errors such as the free-plan chat limit", async () => {
    state.result = { data: null, error: { code: "P0001", message: "LIMITE_CHATS" } };
    await expect(openConversation(ME, OTHER, null)).rejects.toMatchObject({
      message: "LIMITE_CHATS",
    });
  });
});
