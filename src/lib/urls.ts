import { isUuid } from "@/lib/data";

/** Endereços do app. Perfil e vaga usam um nome legível; o id (uuid) segue funcionando como reserva. */

/** Endereço público do site (sitemap, links e textos que mostram o endereço). */
export const SITE_URL = "https://beecos.com.br";
export const SITE_HOST = "beecos.com.br";

/** Vaga sem profissão do catálogo ("Outro") fica sob este nome. */
export const NO_PROFESSION = "outros";

type WithSlug = { id: string; slug?: string | null | undefined };

/** Parâmetro de /perfil/$slug: o nome legível, ou o id enquanto a pessoa ainda não tem nome. */
export function profileParam(p: WithSlug): string {
  return p.slug || p.id;
}

export type PostRef = {
  slug: string;
  professions?: { slug?: string | null } | null;
};

/** Parâmetros de /vagas/$profissao/$codigo. */
export function postParams(p: PostRef): { profissao: string; codigo: string } {
  return { profissao: p.professions?.slug || NO_PROFESSION, codigo: p.slug };
}

/** Texto de uma rota antiga com id, para quem ainda tem o link salvo. */
export { isUuid };
