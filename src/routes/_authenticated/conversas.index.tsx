import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/conversas/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Conversas — Beecos" },
      { name: "description", content: "Suas negociações no Beecos." },
      { property: "og:title", content: "Conversas — Beecos" },
      { property: "og:description", content: "Suas negociações no Beecos." },
    ],
  }),
  component: Empty,
});

/** Aparece só no computador, quando nenhuma conversa está aberta. */
function Empty() {
  return (
    <div className="chat-bg flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground bg-primary">
        <MessageCircle className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="text-2xl">Suas conversas</h2>
      <p className="max-w-sm text-muted-foreground">Escolha uma conversa na lista.</p>
    </div>
  );
}
