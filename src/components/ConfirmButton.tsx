import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/lib/confirm";

/**
 * Botão que pergunta "Tem certeza que deseja …?" antes da ação.
 * A janela é a mesma do app inteiro (ConfirmHost).
 */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "outline",
  size = "sm",
  disabled,
  loading,
  danger = true,
}: {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => unknown;
  variant?: "default" | "outline" | "destructive";
  size?: "default" | "sm";
  disabled?: boolean;
  loading?: boolean;
  /** Botão de confirmar em vermelho (apagar, cancelar). Use false para ações que só avançam. */
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      loading={loading ?? false}
      onClick={async () => {
        if (await confirmAction({ title, description, confirmLabel, danger })) await onConfirm();
      }}
    >
      {children}
    </Button>
  );
}
