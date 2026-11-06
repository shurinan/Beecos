import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from "@/lib/push";

const HINT: Record<PushState, string> = {
  unsupported: "Este navegador não mostra avisos do sistema. Tente no Chrome, Edge ou Safari.",
  "ios-install":
    "No iPhone, os avisos só funcionam com o Beecos instalado: toque em Compartilhar e em “Adicionar à Tela de Início”, e abra por lá.",
  denied:
    "Os avisos estão bloqueados neste aparelho. Libere as notificações do Beecos nas configurações do navegador e volte aqui.",
  off: "Mensagens e vagas novas aparecem na barra de notificações, mesmo com o Beecos fechado.",
  on: "Ligados neste aparelho. Mensagens e vagas novas aparecem na barra de notificações.",
};

function useLabel(state: PushState | null) {
  return state === "on" ? "Ligados" : "Desligados";
}

/** Avisos do sistema neste aparelho (barra de notificações), com ativar, desligar e testar. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const { userId } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const label = useLabel(state);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  if (!userId || state === null) return null;
  // no cartão das conversas só aparece quando ainda dá para ligar
  if (compact && (state === "on" || state === "unsupported")) return null;

  async function turnOn() {
    setBusy(true);
    const next = await enablePush(userId!);
    setState(next);
    setBusy(false);
    if (next === "on") toast.success("Avisos ligados neste aparelho.");
    else if (next === "denied")
      toast.error("Você bloqueou os avisos. Dá para liberar nas configurações do navegador.");
    else if (next === "off") toast.error("Não foi possível ligar os avisos. Tente de novo.");
  }
  async function turnOff() {
    setBusy(true);
    await disablePush().catch(() => undefined);
    setState(await getPushState());
    setBusy(false);
  }
  async function test() {
    try {
      const ok = await sendTestPush();
      toast.success(
        ok ? "Aviso de teste enviado. Ele chega em alguns segundos." : "Ligue os avisos primeiro.",
      );
    } catch {
      toast.error("Não foi possível enviar o teste.");
    }
  }

  if (compact) {
    return (
      <div className="block-card flex items-center gap-3 p-3">
        <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-semibold">{HINT[state]}</p>
        {state === "off" && (
          <Button size="sm" loading={busy} onClick={() => void turnOn()}>
            Ativar avisos
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border-2 border-foreground/20 p-3">
      <div className="flex items-center gap-3">
        {state === "on" ? (
          <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <BellOff className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Avisos na barra de notificações</p>
          <p className="text-sm text-muted-foreground">{HINT[state]}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border-[1.5px] border-foreground px-2 py-px text-xs font-bold ${state === "on" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <Button size="sm" loading={busy} onClick={() => void turnOn()}>
            Ativar neste aparelho
          </Button>
        )}
        {state === "on" && (
          <>
            <Button size="sm" variant="outline" onClick={() => void test()}>
              Testar
            </Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => void turnOff()}>
              Desligar neste aparelho
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
