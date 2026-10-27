export type AdPlacement = "feed" | "profile";

export type Ad = {
  id: string;
  placement: string;
  sponsor: string;
  title: string;
  body: string;
  image_url: string | null;
  link_url: string;
};

/** Só deixa passar http(s). Anúncio com link estranho (javascript:, data:…) é descartado. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Escolhe um anúncio válido. `seed` mantém a escolha estável durante a sessão (sem piscar a cada render). */
export function pickAd(ads: Ad[] | null | undefined, seed = 0): Ad | null {
  const valid = (ads ?? []).filter((a) => safeHttpUrl(a.link_url));
  if (valid.length === 0) return null;
  return valid[Math.abs(Math.floor(seed)) % valid.length]!;
}

/** Posição (índice) depois da qual o anúncio entra no feed: só aparece se houver itens de sobra depois dele. */
export const FEED_AD_AFTER = 4;

export function shouldShowFeedAd(itemCount: number): boolean {
  return itemCount > FEED_AD_AFTER;
}
