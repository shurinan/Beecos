import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostKind } from "@/lib/data";

/** Filtros da busca no início. Preços e nota ficam como texto até a pessoa terminar de digitar. */
export type FeedFilters = {
  kind: PostKind;
  q: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  onlyPremium: boolean;
};

export const EMPTY_FILTERS: FeedFilters = {
  kind: "job",
  q: "",
  city: "",
  minPrice: "",
  maxPrice: "",
  minRating: "",
  onlyPremium: false,
};

export const RATING_OPTIONS = [
  { value: "", label: "Qualquer nota" },
  { value: "3", label: "3 estrelas ou mais" },
  { value: "4", label: "4 estrelas ou mais" },
  { value: "4.5", label: "4,5 ou mais" },
] as const;

/** "1.200,50" e "350" viram número; vazio ou lixo viram null. */
export function parseMoneyInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Quantos filtros além do tipo (vaga ou trabalhador) e da busca estão ligados. */
export function activeFilterCount(f: FeedFilters): number {
  return [
    f.city.trim() !== "",
    parseMoneyInput(f.minPrice) !== null,
    parseMoneyInput(f.maxPrice) !== null,
    f.minRating !== "",
    f.onlyPremium,
  ].filter(Boolean).length;
}

/** Argumentos da função de busca no banco. Só manda o que a pessoa preencheu. */
export function searchArgs(f: FeedFilters) {
  const min = parseMoneyInput(f.minPrice);
  const max = parseMoneyInput(f.maxPrice);
  const rating = f.minRating ? Number(f.minRating) : null;
  return {
    _kind: f.kind,
    _city: f.city.trim(),
    _q: f.q.trim(),
    ...(min !== null ? { _min_price: min } : {}),
    ...(max !== null ? { _max_price: max } : {}),
    ...(rating !== null && Number.isFinite(rating) ? { _min_rating: rating } : {}),
    _only_premium: f.onlyPremium,
    _limit: 50,
  };
}

/** Assuntos do início: tocar neles busca pelo termo. */
export const TOPICS = [
  { label: "Obras e reformas", q: "obra", icon: "hardhat" },
  { label: "Elétrica", q: "eletricista", icon: "zap" },
  { label: "Encanamento", q: "encanador", icon: "droplets" },
  { label: "Limpeza", q: "limpeza", icon: "sparkles" },
  { label: "Mudanças e fretes", q: "mudança", icon: "truck" },
  { label: "Saúde", q: "saúde", icon: "heart" },
  { label: "Beleza", q: "barbeiro", icon: "scissors" },
  { label: "Entregas", q: "entrega", icon: "bike" },
] as const;

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Quais destes usuários têm plano Premium ativo (a lista é pública: só os ids). */
export function usePremiumIds(ids: (string | null | undefined)[]): Set<string> {
  const list = [...new Set(ids.filter((x): x is string => !!x))].sort();
  const { data } = useQuery({
    queryKey: ["premium", list],
    enabled: list.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premium_users")
        .select("user_id")
        .in("user_id", list);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id).filter((x): x is string => !!x));
    },
  });
  return data ?? new Set<string>();
}
