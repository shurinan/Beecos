import { useCanGoBack, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** O botão aparece em toda página, menos na inicial e na conversa aberta (que já tem o seu). */
export function showBackButton(pathname: string): boolean {
  if (pathname === "/") return false;
  return !/^\/conversas\/[^/]+\/?$/.test(pathname);
}

/** Volta para a página anterior; se a pessoa abriu o link direto (sem histórico), vai para o início. */
export function BackButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  if (!showBackButton(pathname)) return null;
  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() => (canGoBack ? router.history.back() : navigate({ to: "/" }))}
      className="-ml-2 mr-1 flex h-10 w-10 items-center justify-center rounded-md text-foreground active:bg-foreground/10"
    >
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
