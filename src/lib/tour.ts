import { useSyncExternalStore } from "react";

/**
 * Tutorial de boas-vindas: aparece uma vez para quem acabou de criar a conta
 * e pode ser revisto em Ajuda › "Ver o tutorial de novo".
 */

export type TourStep = {
  /** valor do atributo data-tour do botão destacado; sem alvo = cartão no meio da tela */
  target?: string;
  title: string;
  text: string;
  /** destaque redondo (botões redondos) */
  round?: boolean;
};

export const MOBILE_STEPS: TourStep[] = [
  { target: "m-vagas", title: "Vagas", text: "Profissionais e vagas de serviço perto de você." },
  {
    target: "m-comunidade",
    title: "Comunidade",
    text: "Grupos da sua profissão para trocar dicas e indicações.",
    round: true,
  },
  {
    target: "m-minhas",
    title: "Minhas vagas",
    text: "O que você publicou e as vagas em que você tem interesse.",
  },
  {
    target: "publicar-fab",
    title: "Publicar",
    text: "Toque no + para contratar um profissional ou oferecer o seu serviço.",
    round: true,
  },
  {
    target: "m-conversas",
    title: "Conversas",
    text: "Combine tudo direto no chat, sem intermediários.",
  },
  {
    target: "sino",
    title: "Avisos",
    text: "Vagas novas, respostas e novidades chegam aqui.",
    round: true,
  },
  {
    target: "ideia",
    title: "Ideia?",
    text: "Mande sugestões para melhorar o Beecos.",
    round: true,
  },
  {
    target: "m-perfil",
    title: "Seu perfil",
    text: "Aqui ficam suas habilidades, plano, indicações e configurações.",
    round: true,
  },
  {
    title: "Pronto!",
    text: "Agora cadastre o que você sabe fazer para aparecer para quem procura um profissional.",
  },
];

export const DESKTOP_STEPS: TourStep[] = [
  { target: "d-vagas", title: "Vagas", text: "Profissionais e vagas de serviço perto de você." },
  {
    target: "d-comunidade",
    title: "Comunidade",
    text: "Grupos da sua profissão para trocar dicas e indicações.",
  },
  {
    target: "d-minhas",
    title: "Minhas vagas",
    text: "O que você publicou e as vagas em que você tem interesse.",
  },
  {
    target: "d-conversas",
    title: "Conversas",
    text: "Combine tudo direto no chat, sem intermediários.",
  },
  {
    target: "d-perfil",
    title: "Meu perfil",
    text: "Aqui ficam suas habilidades, plano, indicações e configurações.",
  },
  {
    target: "d-publicar",
    title: "Publicar",
    text: "Contrate um profissional ou ofereça o seu serviço.",
  },
  {
    target: "ideia",
    title: "Ideia?",
    text: "Mande sugestões para melhorar o Beecos.",
    round: true,
  },
  {
    target: "sino",
    title: "Avisos",
    text: "Vagas novas, respostas e novidades chegam aqui.",
    round: true,
  },
  {
    title: "Pronto!",
    text: "Agora cadastre o que você sabe fazer para aparecer para quem procura um profissional.",
  },
];

/** Contas criadas a partir daqui veem o tutorial sozinhas; as mais antigas só pela Ajuda. */
export const TOUR_SINCE = "2026-11-07T18:00:00Z";

const KEY = "beecos-tour-visto";

export function tourSeenLocally(userId: string): boolean {
  try {
    return localStorage.getItem(`${KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

export function markTourSeenLocally(userId: string) {
  try {
    localStorage.setItem(`${KEY}:${userId}`, "1");
  } catch {
    /* sem armazenamento: vale o registro na conta */
  }
}

/** Deve abrir sozinho? Só para conta nova que ainda não viu (nem neste aparelho, nem na conta). */
export function shouldAutoStart(
  user:
    { id: string; created_at?: string; user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.user_metadata?.["tour_visto"] === true) return false;
  if (tourSeenLocally(user.id)) return false;
  if (!user.created_at) return false;
  return new Date(user.created_at).getTime() >= new Date(TOUR_SINCE).getTime();
}

// "Ver o tutorial de novo": um pedido simples que o tutorial (no AppShell) escuta
let requested = 0;
const listeners = new Set<() => void>();
export function startTour() {
  requested++;
  listeners.forEach((l) => l());
}
export function useTourRequest(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => requested,
    () => 0,
  );
}

// tutorial aberto agora (o balão "Tem uma ideia?" espera ele fechar)
let active = false;
const activeListeners = new Set<() => void>();
export function setTourActive(v: boolean) {
  if (active === v) return;
  active = v;
  activeListeners.forEach((l) => l());
}
export function useTourActive(): boolean {
  return useSyncExternalStore(
    (l) => {
      activeListeners.add(l);
      return () => activeListeners.delete(l);
    },
    () => active,
    () => false,
  );
}

// o último passo leva ao perfil e abre "Adicionar habilidade"
let pendingSkill = false;
export function requestNewSkill() {
  pendingSkill = true;
}
export function takeNewSkillRequest(): boolean {
  const v = pendingSkill;
  pendingSkill = false;
  return v;
}

/** Onde fica o balão: embaixo do botão se ele está na metade de cima da tela, senão em cima. */
export function placeTip(
  rect: { top: number; bottom: number; left: number; width: number },
  view: { width: number; height: number },
  tipWidth: number,
): { top?: number; bottom?: number; left: number } {
  const gap = 16;
  const center = rect.left + rect.width / 2;
  const left = Math.max(12, Math.min(center - tipWidth / 2, view.width - tipWidth - 12));
  if (rect.top + (rect.bottom - rect.top) / 2 < view.height / 2) {
    return { top: rect.bottom + gap, left };
  }
  return { bottom: view.height - rect.top + gap, left };
}
