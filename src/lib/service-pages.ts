import { supabase } from "@/integrations/supabase/client";
import { cityName, citySlug, publicCity, titleFromSlug } from "@/lib/location";
import { isPostOpen, NOINDEX } from "@/lib/seo";
import { SITE_URL } from "@/lib/urls";

/** Páginas /servicos/profissao e /servicos/profissao/cidade: só o que já é público nos posts abertos. */

export const SERVICE_PAGE_SIZE = 30;

export type ServicePagePost = {
  slug: string;
  kind: string;
  title: string;
  /** Só a cidade (nunca CEP ou endereço). */
  city: string;
  price: string;
  created_at: string;
};

export type ServicePageData = {
  profession: { name: string; slug: string } | null;
  city: { slug: string; name: string } | null;
  posts: ServicePagePost[];
  /** Total real de posts abertos desta página (profissão e cidade), não só os exibidos. */
  total: number;
  /** Outras cidades com posts abertos desta profissão (links internos). */
  cities: { slug: string; name: string }[];
};

type Row = {
  slug: string | null;
  kind: string;
  title: string;
  city: string | null;
  price: string | null;
  created_at: string;
  expires_at: string | null;
  closed_at: string | null;
  hidden_at: string | null;
};

/** Monta a página a partir das linhas já lidas (ordem: mais nova primeiro). */
export function buildServicePage(
  profession: { name: string; slug: string } | null,
  rows: Row[],
  cityParam?: string,
  now = Date.now(),
): ServicePageData {
  if (!profession) return { profession: null, city: null, posts: [], total: 0, cities: [] };
  const open = rows.filter((r) => r.slug && isPostOpen(r, now));

  const cityMap = new Map<string, string>();
  for (const r of open) {
    const s = citySlug(r.city);
    if (s && !cityMap.has(s)) cityMap.set(s, cityName(r.city));
  }

  const inCity = cityParam ? open.filter((r) => citySlug(r.city) === cityParam) : open;
  const city = cityParam
    ? { slug: cityParam, name: cityMap.get(cityParam) || titleFromSlug(cityParam) }
    : null;

  return {
    profession,
    city,
    posts: inCity.slice(0, SERVICE_PAGE_SIZE).map((r) => ({
      slug: r.slug as string,
      kind: r.kind,
      title: r.title,
      city: publicCity(r.city),
      price: r.price ?? "",
      created_at: r.created_at,
    })),
    total: inCity.length,
    cities: [...cityMap]
      .filter(([s]) => s !== cityParam)
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

export async function loadServicePage(
  professionSlug: string,
  cityParam?: string,
): Promise<ServicePageData> {
  const { data: prof, error: profError } = await supabase
    .from("professions")
    .select("id, name, slug")
    .eq("slug", professionSlug)
    .eq("active", true)
    .maybeSingle();
  if (profError) throw new Error("Não foi possível carregar esta página agora.");
  if (!prof) return buildServicePage(null, [], cityParam);

  const { data, error } = await supabase
    .from("posts")
    .select("slug, kind, title, city, price, created_at, expires_at, closed_at, hidden_at")
    .eq("profession_id", prof.id)
    .is("hidden_at", null)
    .is("closed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error("Não foi possível carregar esta página agora.");
  return buildServicePage({ name: prof.name, slug: prof.slug }, (data ?? []) as Row[], cityParam);
}

export const SERVICE_TITLE_MAX = 60;
const SUFFIX = " | Beecos";
const PITCH = "Converse direto pelo chat e combine o serviço. Precisou? Achou. Combinou? Fechou.";

/** Tira espaços duplicados e das pontas ("Cuidador(a)  de idosos " -> "Cuidador(a) de idosos"). */
function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Título com no máximo 60 caracteres: tira " | Beecos" e, se ainda passar, usa só o nome. */
export function serviceTitle(profession: string, city?: string): string {
  const name = tidy(profession);
  const place = city ? tidy(city) : "";
  const full = place
    ? `${name} em ${place}: profissionais e vagas`
    : `${name}: profissionais e vagas perto de você`;
  const fits = (t: string) => [...t].length <= SERVICE_TITLE_MAX;
  if (fits(full + SUFFIX)) return full + SUFFIX;
  if (fits(full)) return full;
  return place ? `${name} em ${place}` : name;
}

/** Descrição: com número quando n = 1 ou n >= 3; sem número quando n = 0 ou 2. */
export function serviceDescription(profession: string, total: number, city?: string): string {
  const lower = tidy(profession).toLocaleLowerCase("pt-BR");
  const where = city ? `em ${tidy(city)}` : "perto de você";
  if (total === 1) return `Veja 1 anúncio aberto de ${lower} ${where}. ${PITCH}`;
  if (total >= 3) return `Veja ${total} anúncios abertos de ${lower} ${where}. ${PITCH}`;
  return `Encontre ${lower} ${where} ou ache vagas. ${PITCH}`;
}

/** Título, descrição, canonical e robots de cada página. Sem post aberto = noindex. */
export function servicePageMeta(
  data: ServicePageData | undefined,
  params: { profissao: string; cidade?: string },
) {
  const path = `/servicos/${params.profissao}${params.cidade ? `/${params.cidade}` : ""}`;
  const canonical = `${SITE_URL}${path}`;
  const prof = data?.profession;
  if (!prof) {
    return {
      title: "Serviço não encontrado | Beecos",
      description: "Veja os serviços e profissionais perto de você no Beecos.",
      canonical,
      robots: NOINDEX as string | null,
    };
  }
  const city = data.city?.name || undefined;
  return {
    title: serviceTitle(prof.name, city),
    description: serviceDescription(prof.name, data.total, city),
    canonical,
    robots: data.total > 0 ? null : NOINDEX,
  };
}
