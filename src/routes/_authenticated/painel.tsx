import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: o painel agora é o perfil.
export const Route = createFileRoute("/_authenticated/painel")({
  beforeLoad: () => {
    throw redirect({ to: "/perfil", replace: true });
  },
});
