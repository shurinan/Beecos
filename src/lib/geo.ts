import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Erro com mensagem pronta para mostrar à pessoa. */
export class GeoError extends Error {}

export const BASE_RADIUS_KM = 20;

/** Quantos km o Premium soma aos 20 do plano grátis. */
export const EXPANDED_OPTIONS = [
  { value: 0, label: "Sem expansão" },
  { value: 5, label: "+5 km" },
  { value: 10, label: "+10 km" },
  { value: 20, label: "+20 km" },
  { value: 30, label: "+30 km" },
] as const;

export function cepDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function isValidCep(raw: string): boolean {
  return /^\d{8}$/.test(raw.replace(/\D/g, ""));
}

/** 06010000 -> 06010-000 (enquanto digita, mostra só o que já foi escrito). */
export function formatCep(raw: string): string {
  const d = cepDigits(raw);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export type Place = {
  cep: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

type Fetcher = (url: string) => Promise<Response>;

const inBrazil = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -34 &&
  lat <= 6 &&
  lng >= -75 &&
  lng <= -33;

async function getJson(fetcher: Fetcher, url: string): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetcher(url);
  } catch {
    throw new GeoError("Sem conexão para buscar o CEP. Tente de novo.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* resposta sem corpo */
  }
  return { status: res.status, body };
}

async function nominatim(
  fetcher: Fetcher,
  q: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
  try {
    const { body } = await getJson(fetcher, url);
    const first = Array.isArray(body)
      ? (body[0] as { lat?: string; lon?: string } | undefined)
      : undefined;
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    return inBrazil(lat, lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * CEP -> cidade, estado e um ponto no mapa. Primeiro o BrasilAPI (que às vezes já traz o ponto);
 * se não trouxer, procura a rua e, por fim, a cidade. O ponto é só para calcular distância.
 */
export async function lookupCep(raw: string, fetcher: Fetcher = (u) => fetch(u)): Promise<Place> {
  const cep = cepDigits(raw);
  if (cep.length !== 8) throw new GeoError("O CEP tem 8 números.");
  const { status, body } = await getJson(fetcher, `https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (status === 404) throw new GeoError("CEP não encontrado. Confira os números.");
  const d = body as {
    city?: string;
    state?: string;
    neighborhood?: string;
    street?: string;
    location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
  } | null;
  if (status >= 400 || !d?.city) {
    throw new GeoError("Não consegui consultar o CEP agora. Tente de novo em instantes.");
  }
  const city = d.city;
  const state = (d.state ?? "").toUpperCase().slice(0, 2);
  const given = {
    lat: Number(d.location?.coordinates?.latitude),
    lng: Number(d.location?.coordinates?.longitude),
  };
  let point: { lat: number; lng: number } | null = inBrazil(given.lat, given.lng) ? given : null;
  if (!point && d.street) {
    point = await nominatim(
      fetcher,
      `${d.street}, ${d.neighborhood ?? ""}, ${city}, ${state}, Brasil`,
    );
  }
  if (!point) point = await nominatim(fetcher, `${city}, ${state}, Brasil`);
  if (!point) {
    throw new GeoError("Não consegui localizar esse CEP no mapa. Tente o CEP de uma rua próxima.");
  }
  return { cep, city, state, lat: point.lat, lng: point.lng };
}

/** "menos de 1 km", "3,4 km", "12 km". */
export function formatKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return "menos de 1 km";
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export type WorkArea = {
  postal_code: string;
  city: string;
  state: string;
  expanded_km: number;
};

export function useWorkArea(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["work-area", userId],
    enabled: !!userId,
    queryFn: async (): Promise<WorkArea | null> => {
      const { data, error } = await supabase
        .from("work_areas")
        .select("postal_code, city, state, expanded_km")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type PostDistance = { km: number; notifyKm: number; far: boolean };

/** Distância de cada vaga até a pessoa logada (só para quem informou onde atua). */
export function usePostDistances(
  userId: string | null | undefined,
  ids: string[],
): Map<string, PostDistance> {
  const key = [...ids].sort();
  const { data } = useQuery({
    queryKey: ["post-distances", userId, key],
    enabled: !!userId && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_post_distances", { _post_ids: ids });
      if (error) throw error;
      const map = new Map<string, PostDistance>();
      for (const r of data ?? []) {
        map.set(r.post_id, { km: Number(r.km), notifyKm: r.notify_km, far: r.far });
      }
      return map;
    },
  });
  return data ?? new Map();
}
