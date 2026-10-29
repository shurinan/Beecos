import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startCheckout, hasBillingProfile } from "@/lib/billing";
import { formatCpf, isValidCpf } from "@/lib/cpf";

/**
 * Botão de pagar: pede o CPF só na primeira vez (o Asaas exige para emitir a cobrança; não guardamos),
 * cria a cobrança e leva a pessoa para a página de pagamento do Asaas.
 */
export function CheckoutButton({
  userId,
  kind,
  postId,
  children,
  what,
  variant = "default",
  size = "default",
  className,
}: {
  userId: string;
  kind: "premium" | "urgent";
  postId?: string;
  children: ReactNode;
  /** Frase do que está sendo comprado, mostrada no pedido de CPF. */
  what: string;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(withCpf?: string) {
    setBusy(true);
    const r = await startCheckout({ kind, postId, cpf: withCpf });
    if ("error" in r) {
      setBusy(false);
      return void toast.error(r.error);
    }
    window.location.assign(r.url);
  }

  async function click() {
    setBusy(true);
    const known = await hasBillingProfile(userId);
    setBusy(false);
    if (known) return void go();
    setOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        loading={busy && !open}
        onClick={() => void click()}
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seu CPF para o pagamento</DialogTitle>
            <DialogDescription>
              {what} O Asaas, que cuida do pagamento, pede o CPF para emitir a cobrança. Ele vai
              direto para o Asaas e o Beecos não guarda.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!isValidCpf(cpf)) return void toast.error("CPF inválido. Confira os números.");
              void go(cpf);
            }}
          >
            <Label htmlFor={`cpf-${kind}`}>CPF</Label>
            <Input
              id={`cpf-${kind}`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              maxLength={14}
            />
            <DialogFooter>
              <Button type="submit" className="w-full" loading={busy}>
                Ir para o pagamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
