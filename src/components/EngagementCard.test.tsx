import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  engagement: null as null | Record<string, unknown>,
  rpc: vi.fn(async (_fn: string, _args?: unknown) => ({
    error: null as null | { message: string },
  })),
}));

type Chain = {
  select: () => Chain;
  eq: () => Chain;
  in: () => Chain;
  order: () => Chain;
  limit: () => Chain;
  maybeSingle: () => Promise<unknown>;
  then: (res: (v: unknown) => unknown) => Promise<unknown>;
};

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const result = () =>
      Promise.resolve({
        data:
          table === "engagements"
            ? state.engagement
            : table === "post_stats"
              ? [{ post_id: "p1", vacancies: 2, taken: 1 }]
              : [],
        error: null,
      });
    const c: Chain = {
      select: () => c,
      eq: () => c,
      in: () => c,
      order: () => c,
      limit: () => c,
      maybeSingle: result,
      then: (res) => result().then(res),
    };
    return c;
  };
  return { supabase: { from: chain, rpc: state.rpc } };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

import { EngagementCard } from "./EngagementCard";

afterEach(cleanup);
beforeEach(() => {
  state.engagement = null;
  state.rpc.mockClear();
});

const job = { id: "p1", kind: "job", title: "Pintar casa", user_id: "owner" };
const base = {
  conversationId: "c1",
  otherId: "other",
  otherName: "Maria",
  post: job,
  participants: ["owner", "other"] as [string, string],
};

function renderCard(
  userId: string,
  over: Partial<React.ComponentProps<typeof EngagementCard>> = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EngagementCard {...base} userId={userId} providerReplied {...over} />
    </QueryClientProvider>,
  );
}

describe("EngagementCard", () => {
  it("lets the job owner choose, after confirming", async () => {
    renderCard("owner");
    const btn = await screen.findByRole("button", { name: /Escolher este prestador/ });
    fireEvent.click(btn);
    fireEvent.click(await screen.findByRole("button", { name: "Escolher" }));
    await waitFor(() =>
      expect(state.rpc).toHaveBeenCalledWith("choose_provider", { _conversation: "c1" }),
    );
  });

  it("waits for the provider to reply before offering to choose", async () => {
    renderCard("owner", { providerReplied: false });
    expect(await screen.findByText(/Quando Maria responder/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Escolher este prestador/ })).toBeNull();
  });

  it("shows nothing to the interested person before a choice", async () => {
    renderCard("other");
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
    expect(screen.queryByText("Pintar casa")).toBeNull();
  });

  it("asks the chosen provider to accept or decline", async () => {
    state.engagement = {
      id: "e1",
      post_id: "p1",
      conversation_id: "c1",
      client_id: "owner",
      provider_id: "other",
      status: "proposed",
      cancelled_by: null,
    };
    renderCard("other");
    expect(await screen.findByText(/Você foi escolhido/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await waitFor(() =>
      expect(state.rpc).toHaveBeenCalledWith("respond_engagement", { _id: "e1", _accept: true }),
    );
    expect(screen.getByRole("button", { name: "Recusar" })).toBeTruthy();
  });

  it("tells the client it is waiting for the provider, and lets them undo", async () => {
    state.engagement = {
      id: "e1",
      post_id: "p1",
      conversation_id: "c1",
      client_id: "owner",
      provider_id: "other",
      status: "proposed",
      cancelled_by: null,
    };
    renderCard("owner");
    expect(await screen.findByText(/Aguardando Maria aceitar/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desfazer escolha" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aceitar" })).toBeNull();
  });

  it("lets either side mark an accepted service as done", async () => {
    state.engagement = {
      id: "e1",
      post_id: "p1",
      conversation_id: "c1",
      client_id: "owner",
      provider_id: "other",
      status: "accepted",
      cancelled_by: null,
    };
    renderCard("other");
    fireEvent.click(await screen.findByRole("button", { name: /Marcar como concluído/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Concluir" }));
    await waitFor(() =>
      expect(state.rpc).toHaveBeenCalledWith("complete_engagement", { _id: "e1" }),
    );
  });

  it("says 'Contratar' on an offer, where the interested person is the client", async () => {
    renderCard("other", { post: { ...job, kind: "available" }, otherName: "Pedro" });
    expect(await screen.findByRole("button", { name: /Contratar/ })).toBeTruthy();
  });
});
