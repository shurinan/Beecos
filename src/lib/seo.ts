import { SITE_URL } from "@/lib/urls";
import { cityName, cityState } from "@/lib/location";

/** Campos do post usados no SEO. Só o que a página pública já mostra. */
export type SeoPost = {
  slug?: string | null;
  kind: string;
  title: string;
  description?: string | null;
  city?: string | null;
  created_at: string;
  expires_at?: string | null;
  closed_at?: string | null;
  hidden_at?: string | null;
};

export const NOINDEX = "noindex,nofollow";

/** Aberto = não oculto pela moderação, não encerrado e dentro da validade. */
export function isPostOpen(
  p: Pick<SeoPost, "expires_at" | "closed_at" | "hidden_at">,
  now = Date.now(),
): boolean {
  if (p.hidden_at || p.closed_at) return false;
  return !p.expires_at || new Date(p.expires_at).getTime() > now;
}

/** robots da página /v/codigo: some das buscas quando não existe, está encerrada ou vencida. */
export function postRobots(p: SeoPost | null | undefined, now = Date.now()): string | null {
  return p && isPostOpen(p, now) ? null : NOINDEX;
}

export function postCanonical(slug: string): string {
  return `${SITE_URL}/v/${slug}`;
}

/**
 * Dados estruturados da página pública. Vaga = JobPosting, anúncio de profissional = Service.
 * O JobPosting exige quem contrata (hiringOrganization); o post não guarda isso e o nome de quem
 * publicou não aparece na página pública, então a vaga fica sem JSON-LD em vez de inventar dados.
 */
export function postJsonLd(
  p: SeoPost | null | undefined,
  now = Date.now(),
): Record<string, unknown> | null {
  if (!p || !p.slug || !isPostOpen(p, now)) return null;
  const url = postCanonical(p.slug);
  const name = p.title.trim();
  const description = (p.description ?? "").trim();
  const city = cityName(p.city);
  const state = cityState(p.city);

  if (p.kind === "job") {
    const hiringOrganization: string | null = null; // não existe no post
    if (!name || !description || !p.created_at || !city || !hiringOrganization) return null;
    return {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: name,
      description,
      datePosted: p.created_at,
      ...(p.expires_at ? { validThrough: p.expires_at } : {}),
      hiringOrganization: { "@type": "Organization", name: hiringOrganization },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: city,
          ...(state ? { addressRegion: state } : {}),
        },
      },
      url,
    };
  }

  if (!name) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    ...(description ? { description } : {}),
    ...(city ? { areaServed: { "@type": "City", name: city } } : {}),
    url,
  };
}

/** JSON para <script type="application/ld+json"> sem permitir fechar a tag pelo texto. */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
