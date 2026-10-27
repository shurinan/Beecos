/** Nome de usuário estilo Instagram. As regras valem também no banco (is_valid_username). */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** O que a pessoa digita vira o usuário: sem @, minúsculas, só os caracteres permitidos. */
export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, USERNAME_MAX);
}

/** Mesma regra do banco, sem a lista de palavras reservadas (essa só o banco conhece). */
export function isValidUsernameFormat(name: string): boolean {
  return /^[a-z0-9_][a-z0-9._-]{1,28}[a-z0-9_]$/.test(name) && !/[._-][._-]/.test(name);
}

export const USERNAME_HELP =
  "De 3 a 30 caracteres: letras minúsculas, números, ponto, sublinhado e hífen.";

/** Traduz o erro do banco para uma frase simples. */
export function usernameErrorMessage(
  error: { message?: string } | null | undefined,
): string | null {
  const msg = error?.message ?? "";
  if (msg.includes("USUARIO_EM_USO")) return "Esse nome de usuário já está em uso. Escolha outro.";
  if (msg.includes("USUARIO_INVALIDO")) return `Nome de usuário inválido. ${USERNAME_HELP}`;
  return null;
}
