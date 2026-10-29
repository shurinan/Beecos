import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** Botão que leva para a tela de pedido (/checkout), onde a pessoa confere e segue para o pagamento. */
export function CheckoutButton({
  kind,
  postId,
  children,
  variant = "default",
  size = "default",
  className,
}: {
  kind: "premium" | "annual" | "urgent";
  postId?: string;
  children: ReactNode;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Button asChild variant={variant} size={size} {...(className ? { className } : {})}>
      <Link
        to="/checkout"
        search={{
          tipo: kind === "urgent" ? "urgente" : kind === "annual" ? "anual" : "premium",
          vaga: postId,
        }}
      >
        {children}
      </Link>
    </Button>
  );
}
