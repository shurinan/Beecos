/**
 * O serviço de login responde em inglês ("Invalid login credentials"). Aqui a resposta vira uma
 * frase em português. Usa o código do erro quando ele vem e, se não vier, o texto.
 */
const WRONG = "E-mail ou senha incorretos.";
const EXISTS = "Já existe uma conta com esse e-mail.";
const WEAK = "A senha é fraca. Use pelo menos 8 caracteres, misturando letras e números.";
const UNCONFIRMED = "Confirme o seu e-mail antes de entrar. Veja a sua caixa de entrada.";
const BAD_EMAIL = "Digite um e-mail válido.";
const TOO_MANY = "Muitas tentativas. Espere alguns minutos e tente de novo.";
const OFFLINE = "Sem conexão. Confira a internet e tente de novo.";

const BY_CODE: Record<string, string> = {
  invalid_credentials: WRONG,
  user_already_exists: EXISTS,
  email_exists: EXISTS,
  weak_password: WEAK,
  email_not_confirmed: UNCONFIRMED,
  email_address_invalid: BAD_EMAIL,
  validation_failed: "Confira o e-mail e a senha.",
  over_email_send_rate_limit: TOO_MANY,
  over_request_rate_limit: TOO_MANY,
  signup_disabled: "Não é possível criar conta agora. Tente mais tarde.",
};

const BY_TEXT: [RegExp, string][] = [
  [/invalid login credentials/i, WRONG],
  [/already (been )?registered|already exists/i, EXISTS],
  [/password should be at least|weak password/i, WEAK],
  [/email not confirmed/i, UNCONFIRMED],
  [/invalid format|unable to validate email/i, BAD_EMAIL],
  [/rate limit|for security purposes/i, TOO_MANY],
  [/failed to fetch|network/i, OFFLINE],
];

export function authErrorMessage(err: unknown, mode: "in" | "up"): string {
  const fallback =
    mode === "up"
      ? "Não foi possível criar a conta. Tente de novo."
      : "Não foi possível entrar. Tente de novo.";
  if (!err || typeof err !== "object") return fallback;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && BY_CODE[code]) return BY_CODE[code];
  const message = (err as { message?: unknown }).message;
  if (typeof message === "string") {
    for (const [re, text] of BY_TEXT) if (re.test(message)) return text;
  }
  return fallback;
}
