/** Versão dos Termos e da Política em vigor. Precisa ser igual a public.current_terms_version() no banco. */
export const TERMS_VERSION = "2026-10-29";
export const TERMS_UPDATED_LABEL = "29 de outubro de 2026";

/** E-mail do canal de privacidade (encarregado). Preencha quando existir: aparece nas duas páginas. */
export const PRIVACY_CONTACT_EMAIL: string | null = "contato@beecos.com.br";

export function termsErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("TERMOS_DESATUALIZADOS"))
    return "Os termos foram atualizados. Recarregue a página e tente de novo.";
  return null;
}

export function accountErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("CONTA_COM_SERVICO_ATIVO"))
    return "Você tem um serviço combinado em andamento. Conclua ou cancele antes de excluir a conta.";
  return null;
}
