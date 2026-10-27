// Regras do serviço (associação entre quem contrata e quem presta), sem rede, para testar fácil.

export type EngagementStatus = "proposed" | "accepted" | "completed" | "cancelled";

export type Engagement = {
  id: string;
  post_id: string | null;
  conversation_id: string;
  client_id: string;
  provider_id: string;
  status: EngagementStatus;
  cancelled_by: string | null;
};

export const STATUS_LABEL: Record<EngagementStatus, string> = {
  proposed: "Aguardando aceite",
  accepted: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

/** Texto do botão de escolha: quem publica uma vaga escolhe; quem acha uma oferta contrata. */
export function chooseLabel(postKind: string | null | undefined): string {
  return postKind === "available" ? "Contratar" : "Escolher este prestador";
}

export type Actions = {
  choose: boolean;
  accept: boolean;
  decline: boolean;
  complete: boolean;
  cancel: boolean;
  review: boolean;
};

/**
 * O que a pessoa pode fazer agora.
 * `iAmClient`: a pessoa é quem contrata nesta conversa (null = não dá para contratar aqui).
 * `canChoose`: só quem contrata escolhe; é preciso haver publicação e o prestador já ter respondido.
 */
export function availableActions(
  e: Pick<Engagement, "status" | "client_id" | "provider_id"> | null,
  userId: string,
  opts: { iAmClient: boolean; providerReplied: boolean; hasPost: boolean; vacanciesLeft: boolean },
): Actions {
  const none: Actions = {
    choose: false,
    accept: false,
    decline: false,
    complete: false,
    cancel: false,
    review: false,
  };
  if (!e || e.status === "cancelled") {
    return {
      ...none,
      choose: opts.iAmClient && opts.hasPost && opts.providerReplied && opts.vacanciesLeft,
    };
  }
  const party = userId === e.client_id || userId === e.provider_id;
  if (!party) return none;
  const isProvider = userId === e.provider_id;
  return {
    choose: false,
    accept: e.status === "proposed" && isProvider,
    decline: e.status === "proposed" && isProvider,
    complete: e.status === "accepted",
    cancel: e.status === "proposed" || e.status === "accepted",
    review: e.status === "completed",
  };
}

const ERRORS: Record<string, string> = {
  SO_QUEM_CONTRATA_ESCOLHE: "Só quem contrata pode escolher.",
  AINDA_SEM_RESPOSTA: "Espere a pessoa responder na conversa antes de escolher.",
  VAGAS_PREENCHIDAS: "Todas as vagas dessa publicação já foram preenchidas.",
  JA_ESCOLHIDO: "Essa pessoa já foi escolhida.",
  SEM_PUBLICACAO: "Essa conversa não é sobre uma publicação.",
  CONVERSA_INVALIDA: "Conversa inválida.",
  SERVICO_INVALIDO: "Você não pode fazer isso neste serviço.",
  STATUS_INVALIDO: "O serviço já mudou de situação. Atualize a tela.",
  NEGOCIACAO_INVALIDA: "Você não pode fazer isso nesta negociação.",
  NEGOCIACOES_CHEIAS: "Já são 5 negociações abertas. Encerre uma para abrir outra.",
  NEGOCIACAO_ENCERRADA: "A negociação com essa pessoa está encerrada. Reabra antes de escolher.",
  SERVICO_EM_ANDAMENTO: "Essa pessoa já foi escolhida para o serviço.",
};

/** Máximo de negociações abertas ao mesmo tempo em cada vaga. */
export const MAX_NEGOTIATIONS = 5;

/** Traduz o erro das funções do banco para uma frase que a pessoa entende. */
export function serviceErrorMessage(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? "";
  for (const [code, text] of Object.entries(ERRORS)) if (msg.includes(code)) return text;
  return "Não foi possível concluir essa ação. Tente de novo.";
}

/** "2 de 3 vagas preenchidas" / "Vaga preenchida" / "1 vaga". */
export function vacanciesLabel(
  stats: { vacancies: number; taken: number } | null | undefined,
): string | null {
  if (!stats) return null;
  const { vacancies, taken } = stats;
  if (taken >= vacancies) return vacancies === 1 ? "Vaga preenchida" : "Vagas preenchidas";
  if (vacancies === 1) return "1 vaga";
  return `${vacancies - taken} de ${vacancies} vagas abertas`;
}

export const isFilled = (stats: { vacancies: number; taken: number } | null | undefined) =>
  !!stats && stats.taken >= stats.vacancies;

/** Numeração dos interessados pela ordem em que chegaram (1, 2, 3…). */
export function rankByArrival<T extends { created_at: string }>(
  items: T[],
): (T & { rank: number })[] {
  return [...items]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

/** Link do WhatsApp (só dígitos; assume Brasil quando falta o código do país). */
export function whatsappUrl(number: string): string | null {
  const d = number.replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  const full = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${full}`;
}

/** Link para ligar. Assume Brasil quando falta o código do país. */
export function telUrl(number: string): string {
  const d = number.replace(/\D/g, "");
  return `tel:+${d.length <= 11 ? `55${d}` : d}`;
}
