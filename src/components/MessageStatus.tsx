import { Check, CheckCheck, Clock } from "lucide-react";
import type { MessageState } from "@/lib/chat";

const LABEL: Record<MessageState, string> = {
  waiting: "Aguardando envio",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
};

/** Relógio (aguardando), um tique (enviada), dois tiques (entregue) e dois tiques azuis (lida). */
export function MessageStatus({ state }: { state: MessageState }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  return (
    <span role="img" aria-label={LABEL[state]} title={LABEL[state]} className="inline-flex">
      {state === "waiting" && <Clock className={cls + " opacity-60"} aria-hidden="true" />}
      {state === "sent" && <Check className={cls + " opacity-60"} aria-hidden="true" />}
      {state === "delivered" && <CheckCheck className={cls + " opacity-60"} aria-hidden="true" />}
      {state === "read" && <CheckCheck className={cls + " text-[#1565c0]"} aria-hidden="true" />}
    </span>
  );
}
