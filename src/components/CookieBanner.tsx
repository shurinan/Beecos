import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { needsAnswer, onConsentChange, readChoice, saveChoices, type Purpose } from "@/lib/consent";

const PURPOSES: Purpose[] = ["analytics", "advertising"];
const OPEN_EVENT = "beecos-open-cookie-settings";

/** Abre as preferências de cookies (link permanente no rodapé). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function hasPrivacySignal(): boolean {
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

/**
 * Aviso de cookies: aparece só onde a lei pede (Europa, Reino Unido, Suíça e Canadá)
 * ou quando não dá para saber o país. Fechar ou ignorar não libera nada.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [fromLink, setFromLink] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [gpc, setGpc] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setGpc(hasPrivacySignal());
    void needsAnswer(PURPOSES).then((need) => {
      if (alive && need) setOpen(true);
    });
    const show = () => {
      setAnalytics(readChoice("analytics") === "granted");
      setAdvertising(readChoice("advertising") === "granted");
      setGpc(hasPrivacySignal());
      setSettings(true);
      setFromLink(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    const off = onConsentChange(() => {
      setAnalytics(readChoice("analytics") === "granted");
      setAdvertising(readChoice("advertising") === "granted");
    });
    return () => {
      alive = false;
      window.removeEventListener(OPEN_EVENT, show);
      off();
    };
  }, []);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open, settings]);

  if (!open) return null;

  function answerAll(choice: "granted" | "denied") {
    saveChoices({ analytics: choice, advertising: choice });
    setOpen(false);
    setSettings(false);
  }

  function saveSettings() {
    saveChoices({
      analytics: analytics ? "granted" : "denied",
      advertising: advertising ? "granted" : "denied",
    });
    setOpen(false);
    setSettings(false);
  }

  return (
    <div
      ref={panel}
      role="region"
      aria-label="Aviso de cookies"
      tabIndex={-1}
      className="block-card fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md p-4 outline-none lg:inset-x-auto lg:bottom-4 lg:right-4"
    >
      {!settings ? (
        <>
          <p className="font-bold">Cookies</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contamos as visitas sem cookies. Se você aceitar, também medimos cliques e usamos
            cookies de publicidade para saber quais anúncios do Beecos trazem pessoas ao app.{" "}
            <Link to="/privacidade" className="underline">
              Política de privacidade
            </Link>
            .
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => answerAll("denied")}>
              Recusar tudo
            </Button>
            <Button variant="outline" onClick={() => answerAll("granted")}>
              Aceitar tudo
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setSettings(true)}>
            Configurar cookies
          </Button>
        </>
      ) : (
        <>
          <p className="font-bold">Configurar cookies</p>
          {gpc && (
            <p className="mt-1 text-sm text-muted-foreground">
              O seu navegador pede para não ser rastreado, e respeitamos esse pedido: medição e
              publicidade ficam desligadas.
            </p>
          )}
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-start justify-between gap-3">
              <span>
                <b>Necessários</b>
                <span className="block text-muted-foreground">
                  Manter você conectado e lembrar o tema. Sempre ligados.
                </span>
              </span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <label htmlFor="ck-analytics">
                <b>Medição, fornecida pela Lovable</b>
                <span className="block text-muted-foreground">
                  Cliques e uso do app, sem identificar você.
                </span>
              </label>
              <Switch
                id="ck-analytics"
                checked={!gpc && analytics}
                disabled={gpc}
                onCheckedChange={setAnalytics}
              />
            </li>
            <li className="flex items-start justify-between gap-3">
              <label htmlFor="ck-advertising">
                <b>Publicidade, fornecida pelo Google</b>
                <span className="block text-muted-foreground">
                  Medir os resultados dos anúncios do Beecos e mostrá-los a quem já visitou.
                </span>
              </label>
              <Switch
                id="ck-advertising"
                checked={!gpc && advertising}
                disabled={gpc}
                onCheckedChange={setAdvertising}
              />
            </li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // aberto pelo rodapé: só fecha; aberto pelo aviso: volta ao aviso (nada é liberado)
                if (fromLink) setOpen(false);
                setSettings(false);
                setFromLink(false);
              }}
            >
              {fromLink ? "Cancelar" : "Voltar"}
            </Button>
            <Button onClick={saveSettings} disabled={gpc}>
              Salvar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
