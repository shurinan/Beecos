/**
 * Para onde levar a pessoa depois de entrar: a tela que ela tentou abrir sem estar logada
 * (por exemplo, "Quero contratar"). Vale por 30 minutos e serve uma vez só.
 */
const KEY = "beecos:after-login";
const MAX_AGE_MS = 30 * 60_000;

/** Só endereços do próprio app, nunca a tela de entrar. */
export function safeDestination(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return null;
  if (path === "/auth" || path.startsWith("/auth?") || path.startsWith("/auth#")) return null;
  return path.length <= 500 ? path : null;
}

export function rememberDestination(path: string) {
  const dest = safeDestination(path);
  if (!dest) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ dest, at: Date.now() }));
  } catch {
    // sem armazenamento: depois de entrar a pessoa vai para o perfil
  }
}

export function takeDestination(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const { dest, at } = JSON.parse(raw) as { dest?: unknown; at?: unknown };
    if (typeof at !== "number" || now - at > MAX_AGE_MS) return null;
    return safeDestination(dest);
  } catch {
    return null;
  }
}
