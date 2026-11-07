import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Gestão (/admin). Tudo passa por funções do banco que recusam quem não é moderador. */

export type Period = "hoje" | "7dias" | "mes";

export function periodStart(p: Period, now = new Date()): Date {
  const d = new Date(now);
  if (p === "7dias") return new Date(d.getTime() - 7 * 86400_000);
  d.setHours(0, 0, 0, 0);
  if (p === "mes") d.setDate(1);
  return d;
}

export type Overview = {
  users: number;
  users_new: number;
  providers: number;
  verified: number;
  jobs_open: number;
  jobs_new: number;
  ads_new: number;
  convs_new: number;
  deals_new: number;
  done_new: number;
  premium: number;
  premium_paying: number;
  revenue: number;
  todo: {
    overdue: number;
    verifications: number;
    reports: number;
    suggestions: number;
    emails_failed: number;
    asaas_failed: number;
  };
  funnel: {
    signed_up: number;
    skill: number;
    verified: number;
    posted: number;
    talked: number;
    dealt: number;
  };
};

export type AdminUserRow = {
  id: string;
  full_name: string;
  username: string | null;
  email: string;
  avatar_path: string | null;
  created_at: string;
  premium: boolean;
  plan_term: string | null;
  email_ok: boolean;
  doc: boolean;
  phone: boolean;
  suspended: boolean;
};

export type AdminUser = {
  id: string;
  full_name: string;
  username: string | null;
  email: string;
  avatar_path: string | null;
  created_at: string;
  last_seen_at: string | null;
  email_ok: boolean;
  doc: boolean;
  phone: boolean;
  premium: boolean;
  plan_term: string | null;
  active_until: string | null;
  cancel_requested_at: string | null;
  skills: string[];
  jobs: number;
  ads: number;
  conversations: number;
  deals: number;
  invited: number;
  invited_counted: number;
  invited_by: string | null;
  reports_against: number;
  paid_total: number;
  suspended_until: string | null;
  actions: {
    action: string;
    details: Record<string, unknown>;
    created_at: string;
    by: string | null;
  }[];
};

export function useIsModerator() {
  return useQuery({
    queryKey: ["is-moderator"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_moderator");
      if (error) throw error;
      return !!data;
    },
  });
}

export function useAdminOverview(period: Period, enabled: boolean) {
  return useQuery({
    queryKey: ["admin-overview", period],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_overview", {
        _since: periodStart(period).toISOString(),
      });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });
}

export function useAdminUsers(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["admin-users", q],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_users", { _q: q, _limit: 100 });
      if (error) throw error;
      return (data ?? []) as AdminUserRow[];
    },
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: ["admin-user", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user", { _id: id! });
      if (error) throw error;
      return data as unknown as AdminUser | null;
    },
  });
}

export async function grantPremium(id: string, days: number) {
  const { data, error } = await supabase.rpc("admin_grant_premium", { _id: id, _days: days });
  if (error) throw error;
  return data;
}

export async function suspendUser(id: string, days: number, reason: string) {
  const { data, error } = await supabase.rpc("admin_suspend", {
    _id: id,
    _days: days,
    _reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function unsuspendUser(id: string) {
  const { error } = await supabase.rpc("admin_unsuspend", { _id: id });
  if (error) throw error;
}

export function planLabel(u: { premium: boolean; plan_term: string | null }): string {
  if (!u.premium) return "Grátis";
  switch (u.plan_term) {
    case "annual":
      return "Premium anual";
    case "referral":
      return "Premium (indicação)";
    case "courtesy":
      return "Premium (cortesia)";
    default:
      return "Premium";
  }
}

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type AdminPayment = {
  id: string;
  user_id: string;
  name: string;
  username: string | null;
  email: string | null;
  kind: string;
  value: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  invoice_url: string | null;
};
export type AdminPayments = {
  totals: Record<string, { n: number; value: number }>;
  paid_month: number;
  rows: AdminPayment[];
};

export function useAdminPayments(status: string | null) {
  return useQuery({
    queryKey: ["admin-payments", status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_payments", {
        _status: status,
        _limit: 150,
      });
      if (error) throw error;
      return data as unknown as AdminPayments;
    },
  });
}

export type AdminReferrals = {
  invited: number;
  counted: number;
  rewards: number;
  ranking: {
    user_id: string;
    name: string;
    username: string | null;
    invited: number;
    counted: number;
    rewards: number;
    last_at: string;
  }[];
  recent: {
    created_at: string;
    counted: boolean;
    invitee: string;
    referrer: string;
    referrer_username: string | null;
    email: boolean;
    skill: boolean;
    doc: boolean;
  }[];
};

export function useAdminReferrals() {
  return useQuery({
    queryKey: ["admin-referrals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_referrals");
      if (error) throw error;
      return data as unknown as AdminReferrals;
    },
  });
}

export type AdminEmail = {
  id: string;
  to_email: string;
  kind: string;
  essential: boolean;
  created_at: string;
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
  name: string;
};
export type AdminEmails = {
  sent_today: number;
  sent_7d: number;
  waiting: number;
  failed: number;
  rows: AdminEmail[];
};

export function useAdminEmails(onlyFailed: boolean) {
  return useQuery({
    queryKey: ["admin-emails", onlyFailed],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_emails", {
        _only_failed: onlyFailed,
        _limit: 150,
      });
      if (error) throw error;
      return data as unknown as AdminEmails;
    },
  });
}

export async function retryEmail(id: string) {
  const { error } = await supabase.rpc("admin_retry_email", { _id: id });
  if (error) throw error;
}

/** Nomes em português dos tipos de pagamento e de e-mail. */
export const PAYMENT_KIND: Record<string, string> = {
  premium: "Premium mensal",
  annual: "Premium anual",
  urgent: "Selo Urgente",
};
export const PAYMENT_STATUS: Record<string, string> = {
  paid: "Pago",
  pending: "Aguardando",
  overdue: "Atrasado",
  canceled: "Cancelado",
  refunded: "Devolvido",
};
export const EMAIL_KIND: Record<string, string> = {
  welcome: "Boas-vindas",
  interest: "Interessado",
  new_message: "Mensagem nova",
  unread_digest: "Mensagens não lidas",
  chosen: "Escolhido",
  accepted: "Aceitou",
  declined: "Recusou",
  completed: "Concluído",
  job_digest: "Vagas novas",
  pay_pending: "Cobrança",
  pay_confirmed: "Pagamento confirmado",
  pay_overdue: "Pagamento atrasado",
  premium_ending: "Premium terminando",
  verif_approved: "Verificação aprovada",
  verif_rejected: "Verificação recusada",
  referral_reward: "Prêmio de indicação",
};
