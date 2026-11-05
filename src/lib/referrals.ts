import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/urls";

/**
 * Indique e ganhe. Cada pessoa tem um link com o nome de usuário (beecos.com.br/c/usuario).
 * Quem abre o link fica com o convite guardado neste aparelho; ao criar a conta (ou entrar com o
 * Google), o app registra quem convidou. Traga 5 prestadores, ganhe 1 mês de Premium.
 */
export const INVITE_GOAL = 5;
const KEY = "beecos:convite";
const MAX_AGE_MS = 30 * 86400_000;

export function inviteLink(username: string) {
  return `${SITE_URL}/c/${username}`;
}

export function inviteMessage(username: string) {
  return (
    "Você trabalha com serviço? No Beecos as vagas perto de você chegam no celular, e você " +
    "combina tudo direto no chat. Faz seu cadastro pelo meu link e me dá uma força: " +
    inviteLink(username)
  );
}

export function whatsappShareUrl(username: string) {
  return `https://wa.me/?text=${encodeURIComponent(inviteMessage(username))}`;
}

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function saveInvite(username: string, now = Date.now()) {
  const u = username.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ u, at: now }));
  } catch {
    /* sem armazenamento: o convite vai pelos dados do cadastro */
  }
}

/** O convite guardado neste aparelho (sem apagar). */
export function peekInvite(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { u, at } = JSON.parse(raw) as { u?: unknown; at?: unknown };
    if (typeof u !== "string" || typeof at !== "number" || now - at > MAX_AGE_MS) return null;
    return USERNAME_RE.test(u) ? u : null;
  } catch {
    return null;
  }
}

export function clearInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada a fazer */
  }
}

/** Já tentamos registrar o convite desta conta neste aparelho? (evita repetir a cada visita) */
export function inviteHandled(userId: string): boolean {
  try {
    return localStorage.getItem(`${KEY}:feito:${userId}`) === "1";
  } catch {
    return false;
  }
}

export function markInviteHandled(userId: string) {
  try {
    localStorage.setItem(`${KEY}:feito:${userId}`, "1");
  } catch {
    /* nada a fazer */
  }
}

/** Registra quem convidou (uma vez). Respostas: ok, ja_indicado, conta_antiga, proprio, nao_encontrado. */
export async function claimInvite(username: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_referral", { _username: username });
  if (error) throw error;
  return String(data);
}

export type Inviter = {
  first_name: string;
  full_name: string;
  avatar_path: string | null;
  username: string;
};

export async function getInviter(username: string): Promise<Inviter | null> {
  const { data, error } = await supabase.rpc("referral_inviter", { _username: username });
  if (error) throw error;
  return ((data ?? []) as Inviter[])[0] ?? null;
}

export type Invitee = {
  name: string;
  avatar_path: string | null;
  joined_at: string;
  email: boolean;
  skill: boolean;
  doc: boolean;
  counted: boolean;
  rewarded: boolean;
};

export type ReferralStatus = {
  username: string | null;
  /** Indicados que já contam e ainda não viraram prêmio. */
  counted: number;
  /** Prêmio recente: o próximo só pode sair a partir desta data. */
  next_at: string | null;
  rewards: { kind: "free" | "extend" | "postpone"; granted_at: string; until: string | null }[];
  people: Invitee[];
};

/** O que falta para o indicado contar. */
export function inviteeStep(p: Invitee): { text: string; done: boolean } {
  if (p.rewarded) return { text: "Virou prêmio ✓", done: true };
  if (p.counted) return { text: "Contou ✓", done: true };
  if (!p.email) return { text: "Falta confirmar o e-mail", done: false };
  if (!p.skill) return { text: "Falta 1 habilidade", done: false };
  if (!p.doc) return { text: "Falta verificar identidade", done: false };
  return { text: "Contou ✓", done: true };
}

export function useReferralStatus(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["referral-status", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("referral_status");
      if (error) throw error;
      return data as unknown as ReferralStatus;
    },
  });
}
