/**
 * Abrir o editor da própria publicação de qualquer tela: `openPostEditor(post.id)`.
 * O editor é desenhado pelo <PostEditorHost /> (montado no AppShell para quem está logado).
 */
let host: ((postId: string) => void) | null = null;

export function registerPostEditorHost(fn: (postId: string) => void) {
  host = fn;
  return () => {
    if (host === fn) host = null;
  };
}

/** Abre o editor. Devolve false se não houver editor montado (ex.: sem login). */
export function openPostEditor(postId: string): boolean {
  if (!host) return false;
  host(postId);
  return true;
}
