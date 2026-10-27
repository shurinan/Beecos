// Regras do chat que não dependem da tela: anexos, "visto por último",
// velocidade de resposta e mensagens de erro da moderação.

export const MAX_MESSAGE_LENGTH = 2000;
export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export const ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

const EXT: Record<AttachmentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function validateAttachment(file: { type: string; size: number }): string | null {
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return "Envie uma imagem (JPG, PNG ou WebP) ou um PDF";
  }
  if (file.size <= 0) return "Esse arquivo está vazio";
  if (file.size > ATTACHMENT_MAX_BYTES) return "O arquivo precisa ter até 2 MB";
  return null;
}

/** Caminho dentro da pasta da conversa; nome aleatório evita sobrescrever e adivinhar. */
export function attachmentPath(
  conversationId: string,
  type: string,
  id: string = crypto.randomUUID(),
): string {
  return `${conversationId}/${id}.${EXT[type as AttachmentType] ?? "bin"}`;
}

/** Nome mostrado ao outro lado: sem pasta, curto e sem caracteres de controle. */
export function cleanFileName(name: string): string {
  const noControl = [...name]
    .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join("");
  const base = noControl.split(/[\\/]/).pop()?.trim() ?? "";
  const clean = base || "arquivo";
  if (clean.length <= 120) return clean;
  const dot = clean.lastIndexOf(".");
  const ext = dot > 0 && clean.length - dot <= 8 ? clean.slice(dot) : "";
  return clean.slice(0, 120 - ext.length) + ext;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export const isImageType = (type: string | null | undefined) => !!type && type.startsWith("image/");

/** "visto agora", "visto há 5 min", "visto hoje às 14:30", "visto ontem às 09:10", "visto em 12/10". */
export function formatLastSeen(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const diff = (now.getTime() - t.getTime()) / 1000;
  if (diff < 90) return "visto agora";
  if (diff < 3600) return `visto há ${Math.floor(diff / 60)} min`;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
    d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...o });
  const day = (d: Date) => fmt(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  const hour = fmt(t, { hour: "2-digit", minute: "2-digit" });
  if (day(t) === day(now)) return `visto hoje às ${hour}`;
  if (day(t) === day(new Date(now.getTime() - 86400000))) return `visto ontem às ${hour}`;
  return `visto em ${fmt(t, { day: "2-digit", month: "2-digit" })}`;
}

export const MIN_REPLIES_FOR_BADGE = 3;

/** Selo de velocidade de resposta. Só aparece com respostas suficientes para não enganar. */
export function replySpeedLabel(
  stats: { replies: number; median_seconds: number } | null | undefined,
): string | null {
  if (!stats || stats.replies < MIN_REPLIES_FOR_BADGE) return null;
  const s = stats.median_seconds;
  if (s <= 3600) return "Responde rápido";
  if (s <= 6 * 3600) return "Responde em poucas horas";
  if (s <= 24 * 3600) return "Responde em até 1 dia";
  return null;
}

/** O banco recusa textos com termos proibidos com este erro. */
export function isBlockedTextError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message?.includes("TEXTO_BLOQUEADO");
}

export const BLOCKED_TEXT_MESSAGE =
  "Esse texto tem palavras que não são permitidas no Beecos (ofensas ou assuntos ilegais). Reescreva e tente de novo.";

/** Título e contagem para a aba do navegador: "(3) Beecos". */
export function tabTitle(base: string, unread: number): string {
  return unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
}
