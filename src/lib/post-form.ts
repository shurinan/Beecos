import type { CatalogSelection } from "@/components/CatalogPicker";
import { EMPTY_SELECTION } from "@/components/CatalogPicker";
import type { PostKind } from "@/lib/data";
import { isValidCep, type Place } from "@/lib/geo";

/** Tudo o que a pessoa preenche ao publicar ou editar uma vaga ou anúncio. */
export type PostDraft = {
  kind: PostKind;
  title: string;
  description: string;
  city: string;
  price: string;
  vacancies: number;
  /** CEP digitado (com ou sem traço). Fica oculto: serve só para medir a distância. */
  cep: string;
  /** Resultado da consulta do CEP; nulo enquanto não foi consultado. */
  place: Place | null;
  pick: CatalogSelection;
};

export const EMPTY_DRAFT: PostDraft = {
  kind: "job",
  title: "",
  description: "",
  city: "",
  price: "",
  vacancies: 1,
  cep: "",
  place: null,
  pick: EMPTY_SELECTION,
};

export const MAX_VACANCIES = 20;

/** Primeiro problema que impede de publicar, em palavras simples; nulo se está tudo certo. */
export function draftError(d: PostDraft, minVacancies = 1): string | null {
  if (!d.title.trim()) return "Escreva o título";
  if (!d.pick.professionId && !d.pick.other) {
    return 'Escolha a profissão, ou "Outro" se ela não estiver na lista';
  }
  if (d.kind === "job" && !d.place && !isValidCep(d.cep)) {
    return "Informe o CEP de onde o serviço será feito";
  }
  if (d.cep.trim() !== "" && !isValidCep(d.cep)) return "O CEP tem 8 números";
  if (d.kind === "job" && d.vacancies < Math.max(1, minVacancies)) {
    return `Já há ${minVacancies} ${minVacancies === 1 ? "vaga ocupada" : "vagas ocupadas"}: não dá para ter menos`;
  }
  return null;
}

export function clampVacancies(n: number): number {
  return Math.min(MAX_VACANCIES, Math.max(1, Math.floor(n) || 1));
}

/** Campos da tabela de vagas (o local oculto vai à parte, em post_locations). */
export function draftColumns(d: PostDraft) {
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    city: d.city.trim(),
    price: d.price.trim(),
    vacancies: d.kind === "job" ? d.vacancies : 1,
    profession_id: d.pick.professionId,
    service_id: d.pick.serviceIds[0] ?? null,
  };
}
