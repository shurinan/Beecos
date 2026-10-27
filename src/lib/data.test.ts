import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };

// Minimal chainable stand-in for the PostgREST query builder: every method
// returns the builder, and awaiting it (or .single()) yields the queued result.
const state = vi.hoisted(() => ({
  selects: [] as Result[],
  insert: { data: null, error: null } as Result,
  orFilters: [] as string[],
  inserted: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    const self = () => b;
    b.select = self;
    b.order = self;
    b.limit = self;
    b.eq = self;
    b.is = self;
    b.or = (f: string) => {
      state.orFilters.push(f);
      return b;
    };
    b.insert = (row: unknown) => {
      state.inserted.push(row);
      return {
        select: () => ({ single: async () => state.insert }),
      };
    };
    b.then = (resolve: (r: Result) => unknown) =>
      resolve(state.selects.shift() ?? { data: [], error: null });
    return b;
  };
  return { supabase: { from: () => builder() } };
});

import { isUuid, openConversation } from "./data";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  state.selects = [];
  state.insert = { data: null, error: null };
  state.orFilters = [];
  state.inserted = [];
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
  it("rejects ids that are not uuids before querying", async () => {
    await expect(openConversation(ME, "x),or(user_a.neq.0", null)).rejects.toThrow();
    await expect(openConversation(ME, OTHER, "bad")).rejects.toThrow();
    expect(state.orFilters).toHaveLength(0);
  });

  it("reuses an existing conversation", async () => {
    state.selects = [{ data: [{ id: "c1" }], error: null }];
    await expect(openConversation(ME, OTHER, POST)).resolves.toBe("c1");
    expect(state.inserted).toHaveLength(0);
  });

  it("does not ignore errors from the lookup", async () => {
    state.selects = [{ data: null, error: new Error("boom") }];
    await expect(openConversation(ME, OTHER, null)).rejects.toThrow("boom");
    expect(state.inserted).toHaveLength(0);
  });

  it("creates a conversation when none exists", async () => {
    state.selects = [{ data: [], error: null }];
    state.insert = { data: { id: "new" }, error: null };
    await expect(openConversation(ME, OTHER, null)).resolves.toBe("new");
    expect(state.inserted).toEqual([{ user_a: ME, user_b: OTHER, post_id: null }]);
  });

  it("reuses the winner when it loses the race (23505)", async () => {
    state.selects = [
      { data: [], error: null },
      { data: [{ id: "winner" }], error: null },
    ];
    state.insert = { data: null, error: { code: "23505", message: "duplicate" } };
    await expect(openConversation(ME, OTHER, POST)).resolves.toBe("winner");
  });

  it("propagates other insert errors such as the chat limit", async () => {
    state.selects = [{ data: [], error: null }];
    state.insert = { data: null, error: { code: "P0001", message: "LIMITE_CHATS" } };
    await expect(openConversation(ME, OTHER, null)).rejects.toMatchObject({ message: "LIMITE_CHATS" });
  });
});
