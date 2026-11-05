import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Briefcase, HardHat, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** A pergunta do "+": contratar um profissional ou oferecer um serviço. */
export function NewPostChooser({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const go = (tipo: "contratar" | "trabalhar") => {
    onOpenChange(false);
    void navigate({ to: "/publicar", search: { tipo } });
  };
  const opt =
    "flex w-full items-center gap-3 rounded-xl border-2 border-foreground bg-card p-3 text-left shadow-block transition-transform active:translate-x-0.5 active:translate-y-0.5";
  const ic =
    "flex h-12 w-12 flex-none items-center justify-center rounded-lg border-2 border-foreground bg-primary text-primary-foreground";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="block-card w-[calc(100%-2rem)] max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl">O que você quer fazer?</DialogTitle>
          <DialogDescription className="sr-only">
            Escolha entre publicar uma vaga ou anunciar o seu serviço.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <button type="button" className={opt} onClick={() => go("contratar")}>
            <span className={ic}>
              <Briefcase className="h-6 w-6" aria-hidden="true" />
            </span>
            <span>
              <b className="block text-base">Contratar um profissional</b>
              <span className="text-sm text-muted-foreground">
                Publicar uma vaga para um serviço que preciso
              </span>
            </span>
          </button>
          <button type="button" className={opt} onClick={() => go("trabalhar")}>
            <span className={ic}>
              <HardHat className="h-6 w-6" aria-hidden="true" />
            </span>
            <span>
              <b className="block text-base">Oferecer um serviço profissional</b>
              <span className="text-sm text-muted-foreground">
                Anunciar que estou disponível para trabalhar
              </span>
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** O "+" redondo e amarelo, preso acima do menu de baixo (celular). */
export function NewPostFab({ hidden }: { hidden: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Publicar: contratar ou oferecer serviço"
        data-ajuda="Publicar"
        onClick={() => setOpen(true)}
        className={`fixed bottom-[5.75rem] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground bg-primary text-primary-foreground shadow-block transition-transform duration-200 active:scale-95 lg:hidden ${hidden ? "translate-y-[10rem]" : ""}`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Plus className="h-8 w-8" strokeWidth={2.75} aria-hidden="true" />
      </button>
      <NewPostChooser open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Botão "+ Publicar" do menu de cima (computador). */
export function NewPostHeaderButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-2 hidden items-center gap-1 rounded-lg border-2 border-foreground bg-card px-3 py-1 text-sm font-bold text-foreground shadow-block lg:flex"
      >
        <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> Publicar
      </button>
      <NewPostChooser open={open} onOpenChange={setOpen} />
    </>
  );
}
