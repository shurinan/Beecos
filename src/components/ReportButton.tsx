import { useState } from "react";
import { Flag } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  REPORT_REASONS,
  reportErrorMessage,
  sendReport,
  type ReportReason,
  type ReportTarget,
} from "@/lib/reports";

/** "Denunciar": só envia para a moderação; nada é bloqueado antes de uma pessoa avaliar. */
export function ReportButton({
  type,
  targetId,
  what,
}: {
  type: ReportTarget;
  targetId: string;
  /** "esta vaga" / "este perfil", para o texto do diálogo */
  what: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    try {
      await sendReport(type, targetId, reason, details);
      toast.success("Denúncia enviada. Um moderador vai avaliar.");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (e) {
      toast.error(reportErrorMessage(e) ?? "Não consegui enviar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground underline"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Denunciar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar {what}</DialogTitle>
            <DialogDescription>
              Uma pessoa da moderação vai avaliar. Nada é removido antes disso, e quem você denuncia
              não é avisado de que foi você.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem id={`reason-${r.value}`} value={r.value} />
                <Label htmlFor={`reason-${r.value}`}>{r.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <div>
            <Label htmlFor="report-details">Quer contar mais? (opcional)</Label>
            <Textarea
              id="report-details"
              maxLength={500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!reason || busy} onClick={submit}>
              {busy ? "Enviando…" : "Enviar denúncia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
