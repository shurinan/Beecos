import { SITE_URL } from "@/lib/urls";
import { publicCity } from "@/lib/location";

/**
 * Link público de uma vaga ou anúncio (beecos.com.br/v/codigo). Abre para qualquer pessoa, com
 * prévia no WhatsApp (título, cidade, valor e foto); para falar com quem publicou, a pessoa entra.
 */
export function postShareUrl(slug: string) {
  return `${SITE_URL}/v/${slug}`;
}

type SharePost = { kind: string; title: string; city?: string | null; price?: string | null };

/** A mensagem que vai junto com o link. Quem publicou fala em primeira pessoa. */
export function postShareText(p: SharePost & { slug: string }, mine: boolean) {
  const city = publicCity(p.city);
  const where = city ? ` em ${city}` : "";
  const price = p.price ? ` (${p.price})` : "";
  const url = postShareUrl(p.slug);
  if (p.kind === "job") {
    return mine
      ? `Estou contratando: ${p.title}${where}${price}. Veja os detalhes e fale comigo pelo Beecos: ${url}`
      : `Olha essa vaga no Beecos: ${p.title}${where}${price}. ${url}`;
  }
  return mine
    ? `Ofereço ${p.title}${where}${price}. Veja meu anúncio e fale comigo pelo Beecos: ${url}`
    : `Olha esse profissional no Beecos: ${p.title}${where}${price}. ${url}`;
}

/** Título e descrição da prévia do link (WhatsApp, Facebook, status). */
export function postPreview(p: SharePost & { description?: string | null }) {
  const city = publicCity(p.city);
  const where = city ? ` — ${city}` : "";
  const title = p.kind === "job" ? `Vaga: ${p.title}${where}` : `${p.title}${where}`;
  const desc = (p.description ?? "").replace(/\s+/g, " ").trim();
  const short = desc.length > 150 ? `${desc.slice(0, 147)}…` : desc;
  const description =
    [p.price, short].filter(Boolean).join(" · ") || "Veja no Beecos e converse direto.";
  return { title, description };
}
