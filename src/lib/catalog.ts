import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSkill } from "@/lib/skills";

/** Catálogo em 3 níveis: setor > profissão > serviço. Quem edita é o banco, não o app. */
export type CatalogService = {
  id: string;
  profession_id: string;
  name: string;
  aliases: string[];
  sort: number;
  active: boolean;
};

export type CatalogProfession = {
  id: string;
  sector_id: string;
  name: string;
  aliases: string[];
  sort: number;
  active: boolean;
  /** Só os serviços ativos, na ordem do catálogo. */
  services: CatalogService[];
};

export type CatalogSector = {
  id: string;
  name: string;
  sort: number;
  /** Só as profissões ativas, na ordem do catálogo. */
  professions: CatalogProfession[];
};

export type Catalog = {
  /** Só setores ativos que ainda têm alguma profissão ativa. */
  sectors: CatalogSector[];
  /** Todas as profissões, inclusive desativadas, para mostrar o nome de cadastros antigos. */
  professions: Map<string, CatalogProfession>;
  services: Map<string, CatalogService>;
};

type SectorRow = { id: string; name: string; sort: number; active: boolean };
type ProfessionRow = Omit<CatalogProfession, "services">;
type ServiceRow = CatalogService;

const bySort = <T extends { sort: number; name: string }>(a: T, b: T) =>
  a.sort - b.sort || a.name.localeCompare(b.name, "pt-BR");

export function buildCatalog(
  sectorRows: SectorRow[],
  professionRows: ProfessionRow[],
  serviceRows: ServiceRow[],
): Catalog {
  const services = new Map(serviceRows.map((s) => [s.id, s]));
  const professions = new Map<string, CatalogProfession>();
  for (const p of professionRows) {
    professions.set(p.id, {
      ...p,
      services: serviceRows.filter((s) => s.profession_id === p.id && s.active).sort(bySort),
    });
  }
  const sectors: CatalogSector[] = [];
  for (const s of [...sectorRows].sort(bySort)) {
    if (!s.active) continue;
    const list = [...professions.values()]
      .filter((p) => p.sector_id === s.id && p.active)
      .sort(bySort);
    if (list.length > 0) sectors.push({ id: s.id, name: s.name, sort: s.sort, professions: list });
  }
  return { sectors, professions, services };
}

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Catalog> => {
      const [sectors, professions, services] = await Promise.all([
        supabase.from("sectors").select("id, name, sort, active"),
        supabase.from("professions").select("id, sector_id, name, aliases, sort, active"),
        supabase.from("services").select("id, profession_id, name, aliases, sort, active"),
      ]);
      const error = sectors.error ?? professions.error ?? services.error;
      if (error) throw error;
      return buildCatalog(sectors.data ?? [], professions.data ?? [], services.data ?? []);
    },
  });
}

export type CatalogHit = {
  profession: CatalogProfession;
  /** Preenchido quando o que casou foi um serviço. */
  service?: CatalogService;
};

function haystack(parts: string[]): string {
  return parts.map(normalizeSkill).join(" | ");
}

/**
 * Busca por nome ou apelido ("bico de pedreiro", "chuveiro"). Todas as palavras digitadas
 * precisam aparecer; começo de nome vale mais que o meio. Só entram itens ativos.
 */
export function searchCatalog(catalog: Catalog, query: string, limit = 8): CatalogHit[] {
  const words = normalizeSkill(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { hit: CatalogHit; score: number; label: string }[] = [];
  const score = (name: string, text: string) => {
    if (!words.every((w) => text.includes(w))) return 0;
    const n = normalizeSkill(name);
    return n.startsWith(words[0]!) ? 3 : n.includes(words[0]!) ? 2 : 1;
  };
  for (const sector of catalog.sectors) {
    for (const p of sector.professions) {
      const ps = score(p.name, haystack([p.name, ...p.aliases]));
      if (ps > 0) scored.push({ hit: { profession: p }, score: ps + 1, label: p.name });
      for (const s of p.services) {
        const ss = score(s.name, haystack([s.name, ...s.aliases, p.name, ...p.aliases]));
        if (ss > 0) scored.push({ hit: { profession: p, service: s }, score: ss, label: s.name });
      }
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, limit)
    .map((x) => x.hit);
}

/** "Eletricista · Instalação de chuveiro", ou só a profissão. */
export function catalogLabel(
  profession: { name: string } | null | undefined,
  service: { name: string } | null | undefined,
): string {
  if (!profession) return "";
  return service ? `${profession.name} · ${service.name}` : profession.name;
}
