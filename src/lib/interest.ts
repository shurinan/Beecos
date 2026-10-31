import { toast } from "sonner";
import { limitMessage } from "@/lib/plans";

/** Aviso ao tocar em "Tenho interesse": fila de espera é aviso, o resto é erro. */
export function showInterestError(e: unknown) {
  const msg = (e as { message?: string } | null)?.message ?? "";
  const text = limitMessage(e) ?? "Não foi possível abrir a conversa.";
  if (msg.includes("FILA_ESPERA")) toast.info(text);
  else toast.error(text);
}
