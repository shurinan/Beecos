import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: as mensagens agora são as conversas.
export const Route = createFileRoute("/_authenticated/mensagens/")({
  beforeLoad: () => {
    throw redirect({ to: "/conversas", replace: true });
  },
});
