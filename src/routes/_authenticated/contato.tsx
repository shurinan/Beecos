import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: os contatos agora ficam em /perfil/contato.
export const Route = createFileRoute("/_authenticated/contato")({
  beforeLoad: () => {
    throw redirect({ to: "/perfil/contato", replace: true });
  },
});
