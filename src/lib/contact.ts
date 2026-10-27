// Regras do menu de contato: tipos, rótulos, validação e formatação.
// Tudo aqui é puro (sem rede) para ser fácil de testar.

export const PHONE_KINDS = ["mobile", "home", "work"] as const;
export type PhoneKind = (typeof PHONE_KINDS)[number];
export const PHONE_KIND_LABEL: Record<PhoneKind, string> = {
  mobile: "Celular",
  home: "Residencial",
  work: "Trabalho",
};

export const PHONE_METHODS = ["call", "sms", "whatsapp"] as const;
export type PhoneMethod = (typeof PHONE_METHODS)[number];
export const PHONE_METHOD_LABEL: Record<PhoneMethod, string> = {
  call: "Ligação",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export const MAX_PHONES = 10;

export type ContactPhone = {
  id: string;
  kind: PhoneKind;
  number: string;
  methods: PhoneMethod[];
  /** Visível para quem já conversou de verdade com a pessoa (os dois lados escreveram). */
  shared: boolean;
};
export type PhoneInput = Omit<ContactPhone, "id">;

export const ADDRESS_KINDS = ["physical", "postal"] as const;
export type AddressKind = (typeof ADDRESS_KINDS)[number];
export const ADDRESS_KIND_LABEL: Record<AddressKind, string> = {
  physical: "Endereço físico",
  postal: "Endereço postal",
};

export type ContactAddress = {
  id: string;
  kind: AddressKind;
  recipient: string;
  care_of: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string; // só dígitos, 8
};
export type AddressInput = Omit<ContactAddress, "id">;

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Mantém só os dígitos. */
export function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Telefone aceito: 8 a 15 dígitos (com ou sem DDD/DDI). */
export function isValidPhone(value: string): boolean {
  const d = digits(value);
  return d.length >= 8 && d.length <= 15 && value.trim().length <= 30;
}

export function formatCep(value: string): string {
  const d = digits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(value: string): boolean {
  return digits(value).length === 8;
}

export function formatMethods(methods: readonly PhoneMethod[]): string {
  return PHONE_METHODS.filter((m) => methods.includes(m))
    .map((m) => PHONE_METHOD_LABEL[m])
    .join(", ");
}

/** Linhas para mostrar o endereço, sem linhas vazias. */
export function addressLines(a: AddressInput): string[] {
  return [
    a.recipient,
    a.care_of ? `A/C ${a.care_of}` : "",
    a.street,
    a.neighborhood,
    `${a.city} - ${a.state}`,
    formatCep(a.postal_code),
  ].filter(Boolean);
}

/** Sem o dia exato, a idade pode errar por um ano: usa a data local do navegador. */
export function ageFromBirthDate(birth: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  const before = today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d);
  if (before) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

export function formatBirthDate(birth: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth.split("-").reverse().join("/") : "";
}

export function isValidBirthDate(birth: string, today: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return false;
  const t = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return birth >= "1900-01-01" && birth <= t && !Number.isNaN(Date.parse(birth));
}

/** Nome completo a partir das partes: "Primeiro Outros Último Sufixo". */
export function joinFullName(p: {
  first_name: string;
  other_names: string;
  last_name: string;
  name_suffix: string;
}): string {
  return [p.first_name, p.other_names, p.last_name, p.name_suffix]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" ");
}

/** Erro do banco ao passar do limite de telefones. */
export function phoneLimitMessage(error: { message?: string } | null): string | null {
  return error?.message?.includes("LIMITE_TELEFONES") ? `Máximo de ${MAX_PHONES} telefones` : null;
}

// Autorização de uso dos dados. O texto fica aqui, em um só lugar; a versão muda
// quando o texto muda, e fica gravada junto com a data em que a pessoa aceitou.
export const CONSENT_VERSION = "2026-10";
export const CONSENT_TEXT =
  "Autorizo o Beecos a usar os dados que informei neste menu (nome, contatos, endereços e data de nascimento) para operar a minha conta e viabilizar a negociação com outras pessoas. Esses dados são privados e não aparecem no meu perfil público. Posso retirar esta autorização quando quiser.";

// Foto de perfil
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const AVATAR_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type))
    return "Use uma foto JPG, PNG ou WebP";
  if (file.size > AVATAR_MAX_BYTES) return "A foto precisa ter até 2 MB";
  return null;
}

/** Caminho na pasta do dono; nome novo a cada envio evita foto antiga em cache. */
export function avatarPath(userId: string, type: string, now: number = Date.now()): string {
  return `${userId}/${now}.${AVATAR_EXT[type] ?? "jpg"}`;
}
