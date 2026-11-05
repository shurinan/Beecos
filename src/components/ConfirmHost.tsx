import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { registerConfirmHost, type ConfirmRequest } from "@/lib/confirm";

/** A janela "Tem certeza que deseja …?" do app inteiro. Montada uma vez na raiz. */
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const answered = useRef(false);

  useEffect(
    () =>
      registerConfirmHost((next) => {
        answered.current = false;
        setReq(next);
        setOpen(true);
      }),
    [],
  );

  function answer(ok: boolean) {
    if (!req || answered.current) return;
    answered.current = true;
    req.resolve(ok);
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && answer(false)}>
      <AlertDialogContent className="block-card w-[calc(100%-2rem)] max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-foreground bg-primary"
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="space-y-1.5 text-left">
              <AlertDialogTitle className="font-display text-lg leading-snug">
                {req?.title}
              </AlertDialogTitle>
              {req?.description ? (
                <AlertDialogDescription>{req.description}</AlertDialogDescription>
              ) : (
                <AlertDialogDescription className="sr-only">
                  Confirme ou volte.
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={() => answer(false)}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className={
              req?.danger === false ? undefined : buttonVariants({ variant: "destructive" })
            }
            onClick={() => answer(true)}
          >
            {req?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
