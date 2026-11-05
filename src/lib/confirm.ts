/**
 * Confirmação antes de apagar, remover, sair ou alterar algo que outras pessoas veem.
 * Uso: `if (!(await confirmAction({ title: "Tem certeza que deseja …?", confirmLabel: "Excluir" }))) return;`
 * A janela é desenhada pelo <ConfirmHost /> (montado uma vez na raiz do app).
 */
export type ConfirmOptions = {
  /** Sempre no padrão "Tem certeza que deseja …?" */
  title: string;
  description?: string;
  /** Texto do botão que confirma, com o verbo da ação ("Excluir", "Sair do grupo"). */
  confirmLabel: string;
  /** Pinta o botão de confirmar como perigoso (vermelho). Padrão: sim. */
  danger?: boolean;
};

export type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

let host: ((req: ConfirmRequest) => void) | null = null;

/** Usado só pelo ConfirmHost. Devolve a função para desligar. */
export function registerConfirmHost(fn: (req: ConfirmRequest) => void) {
  host = fn;
  return () => {
    if (host === fn) host = null;
  };
}

/** Pergunta e espera a resposta: true = confirmou, false = voltou. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  // sem a janela montada (ex.: testes de um componente isolado), segue sem perguntar
  if (!host) return Promise.resolve(true);
  const show = host;
  return new Promise((resolve) => show({ ...opts, resolve }));
}
