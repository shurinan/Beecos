import { useEffect, useState } from "react";
import { Bell, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIos, isStandalone, registerServiceWorker } from "@/lib/pwa";
import { notificationsSupported } from "@/lib/chat-hooks";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "beecos:install-dismissed";
const DISMISS_DAYS = 14;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

/** Convite para instalar o Beecos como app. Também registra o service worker. */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    registerServiceWorker();
    if (isStandalone() || dismissedRecently()) return;
    setHidden(false);
    setIosHint(isIos());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* sem armazenamento: o convite volta na próxima visita */
    }
  }

  // Só aparece quando o navegador oferece instalar (Android/computador) ou no iPhone, que precisa de instrução.
  if (hidden || (!event && !iosHint)) return null;

  return (
    <div className="block-card mb-4 flex items-start gap-3 p-3">
      <Download className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">Instale o Beecos no celular</p>
        {event ? (
          <p className="text-muted-foreground">
            Abre mais rápido, em tela cheia, e avisa quando chegar mensagem.
          </p>
        ) : (
          <p className="text-muted-foreground">
            No iPhone: toque em <strong>Compartilhar</strong> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
        )}
        {event && (
          <Button
            size="sm"
            className="mt-2"
            onClick={async () => {
              await event.prompt();
              const choice = await event.userChoice.catch(() => null);
              setEvent(null);
              if (choice?.outcome === "accepted") setHidden(true);
              else dismiss();
            }}
          >
            Instalar
          </Button>
        )}
      </div>
      <button type="button" aria-label="Fechar" onClick={dismiss}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Pede permissão para avisos de mensagem nova. Só pede quando a pessoa toca no botão. */
export function NotificationCard() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  useEffect(() => {
    if (notificationsSupported()) setPermission(Notification.permission);
  }, []);

  if (permission === "unsupported" || permission === "granted") return null;
  if (permission === "denied") {
    return (
      <p className="rounded-lg border-2 border-dashed border-foreground/40 p-3 text-sm text-muted-foreground">
        Os avisos estão bloqueados. Para receber, libere as notificações do Beecos nas configurações
        do navegador.
      </p>
    );
  }
  return (
    <div className="block-card flex items-center gap-3 p-3">
      <Bell className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-semibold">
        Receba um aviso quando chegar mensagem nova.
      </p>
      <Button size="sm" onClick={async () => setPermission(await Notification.requestPermission())}>
        Ativar avisos
      </Button>
    </div>
  );
}
