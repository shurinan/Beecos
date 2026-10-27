import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostFormFields } from "@/components/PostFormFields";
import type { Catalog } from "@/lib/catalog";
import { GeoError, isValidCep, lookupCep } from "@/lib/geo";
import { draftError, type PostDraft } from "@/lib/post-form";

/** Editar uma vaga ou anúncio já publicado. O tipo (vaga ou disponível) não muda. */
export function PostEditDialog({
  open,
  onOpenChange,
  initial,
  catalog,
  minVacancies,
  onSave,
  lookup = lookupCep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: PostDraft | null;
  catalog: Catalog | undefined;
  minVacancies: number;
  /** Recebe o rascunho já com o ponto do CEP (se houver). */
  onSave: (draft: PostDraft) => Promise<boolean>;
  lookup?: typeof lookupCep;
}) {
  const [draft, setDraft] = useState<PostDraft | null>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setBusy(false);
    }
  }, [open, initial]);

  if (!draft) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const problem = draftError(draft, minVacancies);
    if (problem) return void toast.error(problem);
    let next = draft;
    setBusy(true);
    if (!next.place && isValidCep(next.cep)) {
      try {
        next = { ...next, place: await lookup(next.cep) };
      } catch (err) {
        setBusy(false);
        return void toast.error(
          err instanceof GeoError ? err.message : "Não foi possível buscar o CEP",
        );
      }
    }
    const saved = await onSave(next);
    setBusy(false);
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.kind === "job" ? "Editar vaga" : "Editar anúncio"}</DialogTitle>
          <DialogDescription>
            As mudanças valem na hora para quem está vendo a publicação.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <PostFormFields
            draft={draft}
            onChange={setDraft}
            catalog={catalog}
            idPrefix="edit-post"
            minVacancies={minVacancies}
            lookup={lookup}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
