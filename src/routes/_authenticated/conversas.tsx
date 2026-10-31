import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { InboxList } from "@/components/InboxList";

export const Route = createFileRoute("/_authenticated/conversas")({
  staticData: { sitemap: false },
  component: ConversasLayout,
});

/**
 * Conversas no padrão do WhatsApp: no computador, lista à esquerda e conversa à direita;
 * no celular, uma tela de cada vez (a lista, ou a conversa aberta com seta de voltar).
 */
function ConversasLayout() {
  const { userId } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const atList = path === "/conversas" || path === "/conversas/";
  return (
    <div className="-mx-4 lg:mx-0 lg:grid lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[400px_1fr] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:rounded-xl lg:border-2 lg:border-foreground">
      <aside
        className={
          "min-h-0 lg:flex lg:flex-col lg:border-r lg:border-foreground/20 " +
          (atList ? "block" : "hidden")
        }
      >
        <InboxList userId={userId} />
      </aside>
      <section
        className={
          "min-h-0 min-w-0 lg:flex lg:flex-col " +
          (atList ? "hidden" : "flex h-[calc(100dvh-3.9rem)] flex-col lg:h-auto")
        }
      >
        <Outlet />
      </section>
    </div>
  );
}
