import { useState } from "react";
import { Lightbulb } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  SUGGESTION_MAX,
  sendSuggestion,
  suggestionErrorMessage,
  suggestionValid,
} from "@/lib/suggestions";

/** Lâmpada no topo: abre a caixa de sugestões. As ideias chegam só aos moderadores. */
export function SuggestionButton() {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userId || !suggestionValid(text)) return;
    setBusy(true);
    try {
      await sendSuggestion(userId, text);
      toast.success("Ideia enviada. Obrigado por ajudar o Beecos!");
      setText("");
      setOpen(false);
    } catch (e) {
      toast.error(suggestionErrorMessage(e) ?? "Não consegui enviar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Caixa de sugestões"
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-primary-foreground"
      >
        <Lightbulb className="h-6 w-6" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Caixa de sugestões</DialogTitle>
            <DialogDescription>
              Tem uma ideia, um problema ou algo que falta? Conte pra gente. Só a equipe lê.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={SUGGESTION_MAX}
            rows={5}
            placeholder="Escreva aqui a sua ideia…"
            aria-label="Sua ideia"
          />
          <DialogFooter>
            <Button type="button" disabled={busy || !suggestionValid(text)} onClick={() => void submit()}>
              Enviar ideia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
