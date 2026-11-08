/**
 * Localização do perfil: só a cidade ou o CEP (00000-000). Nada de rua, número, bairro ou
 * complemento. Em telas públicas aparece no máximo a cidade, nunca o CEP.
 */

export const CEP_FORMAT = /^\d{5}-\d{3}$/;
export const CITY_MAX = 60;

export const CITY_OR_CEP_HELP =
  "Só a cidade ou o CEP (00000-000). Não coloque rua, número, bairro ou complemento.";

// tipo de logradouro no começo ("Rua X", "Av. Y")
const STREET_START =
  /^(rua|r\.|av|av\.|avenida|travessa|tv\.?|alameda|al\.|estrada|rodovia|rod\.|pra[cç]a|viela|beco)(\s|$)/i;
// palavras de endereço completo em qualquer lugar
const ADDRESS_WORDS =
  /(^|\s)(bairro|apto|apartamento|bloco|complemento|n[uú]mero|n[º°]|cep)(\s|$|\.)/i;
const CITY_CHARS = /^\p{L}[\p{L}\s.'’/-]*$/u;
// "Sorocaba, SP": a única vírgula aceita é antes da sigla do estado
const COMMA_UF = /^[^,]+,\s*[A-Za-z]{2}$/;

function isCityText(v: string): boolean {
  if (v.length < 2 || v.length > CITY_MAX) return false;
  if (/\d/.test(v)) return false;
  if (v.includes(",") && !COMMA_UF.test(v)) return false;
  if (STREET_START.test(v) || ADDRESS_WORDS.test(v)) return false;
  return CITY_CHARS.test(v.replace(",", ""));
}

/** Mensagem de erro para o campo do perfil, ou null se estiver certo. Vazio é permitido. */
export function validateCityOrCep(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (CEP_FORMAT.test(v)) return null;
  if (/^[\d\s.-]+$/.test(v)) return "Escreva o CEP no formato 00000-000.";
  if (v.length > CITY_MAX) return "Nome de cidade muito longo.";
  if (!isCityText(v)) return CITY_OR_CEP_HELP;
  return null;
}

/** Enquanto a pessoa digita só números, já coloca o hífen do CEP. */
export function maskCityOrCep(raw: string): string {
  if (!/^[\d-]+$/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/**
 * O que pode aparecer em tela pública: a cidade como foi escrita, se for só uma cidade.
 * CEP, rua, número ou qualquer texto de endereço some (vira "").
 */
export function publicCity(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  return isCityText(v) ? v : "";
}

/** "Itaquaquecetuba - SP" -> "Itaquaquecetuba" (tira a sigla do estado). */
export function cityName(raw: string | null | undefined): string {
  return publicCity(raw)
    .replace(/\s*[-/,]\s*[A-Za-z]{2}$/, "")
    .trim();
}

/** Sigla do estado, quando escrita junto da cidade ("Sorocaba - SP" -> "SP"). */
export function cityState(raw: string | null | undefined): string {
  const m = publicCity(raw).match(/\s*[-/,]\s*([A-Za-z]{2})$/);
  return m?.[1] ? m[1].toUpperCase() : "";
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Endereço da cidade em /servicos/profissao/cidade. "" quando não há cidade pública. */
export function citySlug(raw: string | null | undefined): string {
  return slugify(cityName(raw));
}

/** "sao-jose-dos-campos" -> "Sao Jose Dos Campos" (só quando não há post para pegar o nome certo). */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
