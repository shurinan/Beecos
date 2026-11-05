import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Lightbulb, X } from "lucide-react";
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
  SUGGESTION_TOPICS,
  sendSuggestion,
  shouldShowNudge,
  suggestionErrorMessage,
  suggestionValid,
  markNudgeShown,
  type SuggestionTopic,
} from "@/lib/suggestions";

/**
 * Botão "Ideia?" no topo: abre a caixa de sugestões. As ideias chegam só à equipe.
 * De vez em quando aparece um balão convidando a sugerir (1ª visita e depois a cada 2 semanas).
 */
export function SuggestionButton() {
  const { userId } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState<SuggestionTopic>("Ideia nova");
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState(false);

  // o balão nunca aparece no meio de uma conversa nem na hora de pagar
  const quiet = path.startsWith("/conversas/") || path === "/checkout" || path === "/pagamento";
  useEffect(() => {
    if (quiet || !shouldShowNudge()) return;
    const show = setTimeout(() => {
      setNudge(true);
      markNudgeShown();
    }, 8000);
    return () => clearTimeout(show);
  }, [quiet]);
  useEffect(() => {
    if (!nudge) return;
    const hide = setTimeout(() => setNudge(false), 12000);
    return () => clearTimeout(hide);
  }, [nudge]);

  function openBox() {
    setNudge(false);
    setOpen(true);
  }

  async function submit() {
    if (!userId || !suggestionValid(text)) return;
    setBusy(true);
    try {
      await sendSuggestion(userId, text, topic);
      toast.success("Ideia enviada. Obrigado por ajudar o Beecos!");
      setText("");
      setTopic("Ideia nova");
      setOpen(false);
    } catch (e) {
      toast.error(suggestionErrorMessage(e) ?? "Não foi possível enviar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Dar uma ideia para o Beecos"
        onClick={openBox}
        className="mx-0.5 flex items-center gap-1.5 rounded-full border-2 border-foreground bg-card py-0.5 pl-1 pr-2.5 text-sm font-bold text-foreground shadow-[2px_2px_0_0_var(--foreground)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border-foreground/40"
      >
        <span className="ideia-brilho flex h-6 w-6 items-center justify-center rounded-full bg-[oklch(0.93_0.12_95)] text-[oklch(0.2_0.02_260)]">
          <Lightbulb className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <span className="max-[374px]:hidden">Ideia?</span>
      </button>

      {nudge && !open && (
        <div
          role="status"
          className="absolute right-0 top-[calc(100%+12px)] z-30 w-60 rounded-xl border-2 border-[#12151B] bg-[#12151B] p-3 text-sm text-white shadow-lg dark:border-white/20"
        >
          <span
            aria-hidden="true"
            className="absolute -top-2 right-6 h-3 w-3 rotate-45 bg-[#12151B]"
          />
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setNudge(false)}
            className="float-right -mr-1 -mt-1 ml-2 p-1 opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={openBox} className="text-left">
            <b className="text-[#F2CE4B]">Tem uma ideia?</b> Conta pra gente o que deixaria o Beecos
            melhor. A equipe lê tudo.
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="block-card w-[calc(100%-2rem)] max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-xl leading-snug">
              💡 O que deixaria o Beecos melhor?
            </DialogTitle>
            <DialogDescription>Sua ideia vai direto para a equipe. Lemos todas.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Assunto">
            {SUGGESTION_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={topic === t}
                onClick={() => setTopic(t)}
                className={`rounded-full border-2 border-foreground px-3 py-1 text-sm font-bold ${topic === t ? "bg-primary text-primary-foreground" : "bg-card"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={SUGGESTION_MAX}
            rows={5}
            placeholder="Escreva aqui…"
            aria-label="Sua ideia"
          />
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="w-full"
              disabled={busy || !suggestionValid(text)}
              onClick={() => void submit()}
            >
              Enviar
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Quando a sua ideia entrar no app, a gente te avisa.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
