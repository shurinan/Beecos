import { useCanGoBack, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** O botão aparece em toda página, menos na inicial e na conversa aberta (que já tem o seu). */
export function showBackButton(pathname: string): boolean {
  if (pathname === "/") return false;
  return !/^\/conversas\/[^/]+\/?$/.test(pathname);
}

/**
 * Página "de cima" de cada endereço: para onde o botão leva quando a pessoa abriu o link direto
 * e não há página anterior no histórico. Nunca é a página inicial por atalho.
 */
export function parentPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "vagas") {
    if (parts.length === 4) return `/vagas/${parts[1]}/${parts[2]}`; // interessados -> a vaga
    if (parts.length === 3) return "/vagas"; // a vaga -> a lista
    return "/";
  }
  if (parts[0] === "perfil") {
    if (parts[1] === "contato") return "/perfil";
    return parts.length === 2 ? "/vagas" : "/";
  }
  return "/";
}

/** Volta para a página em que a pessoa estava; sem histórico, sobe um nível. */
export function BackButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const canGoBack = useCanGoBack();
  if (!showBackButton(pathname)) return null;
  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={() => {
        if (canGoBack || (typeof window !== "undefined" && window.history.length > 1)) {
          router.history.back();
        } else {
          router.history.push(parentPath(pathname));
        }
      }}
      className="-ml-2 mr-1 flex h-10 w-10 items-center lg:hidden justify-center rounded-md text-primary-foreground active:bg-foreground/10"
    >
      <ArrowLeft className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
