import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HELP_DELAY_MS, helpFor, type HelpEntry } from "@/lib/help";

type Open = { entry: HelpEntry; rect: DOMRect };

const TARGET = "[data-ajuda], button, a, [role='button']";

function labelOf(el: Element): string {
  return el.getAttribute("data-ajuda") || el.getAttribute("aria-label") || (el.textContent ?? "");
}

/**
 * Navegação assistida: com o mouse parado 2 s sobre um botão, ou segurando 2 s no celular,
 * abre uma caixinha dizendo o que ele faz. Clicar fora fecha; "Mais ajuda" leva às perguntas.
 */
export function AssistedHelp() {
  const [open, setOpen] = useState<Open | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const suppressClickUntil = useRef(0);

  useEffect(() => {
    const clear = () => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    };
    const arm = (el: Element, touch: boolean) => {
      clear();
      const entry = helpFor(labelOf(el));
      if (!entry) return;
      timer.current = window.setTimeout(() => {
        if (touch) suppressClickUntil.current = Date.now() + 700;
        setOpen({ entry, rect: el.getBoundingClientRect() });
      }, HELP_DELAY_MS);
    };

    let startX = 0;
    let startY = 0;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest(TARGET);
      if (el) arm(el, false);
      else clear();
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === "mouse") clear();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (box.current && t && box.current.contains(t)) return;
      setOpen(null); // clicar fora fecha
      if (e.pointerType === "mouse") {
        clear(); // clicar já é "usar" o botão: não precisa de ajuda
        return;
      }
      const el = (e.target as Element | null)?.closest(TARGET);
      startX = e.clientX;
      startY = e.clientY;
      if (el) arm(el, true);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 10) clear();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") clear();
    };
    const onClick = (e: MouseEvent) => {
      // depois de um toque longo, o "soltar" não deve acionar o botão
      if (Date.now() < suppressClickUntil.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onContext = (e: Event) => {
      if (Date.now() < suppressClickUntil.current + 1500 && suppressClickUntil.current > 0) {
        const el = (e.target as Element | null)?.closest(TARGET);
        if (el && helpFor(labelOf(el))) e.preventDefault();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    const close = () => setOpen(null);
    // teclado: parar 2 segundos num botão com o Tab também mostra a ajuda
    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest(TARGET);
      if (el && el.matches(":focus-visible")) arm(el, false);
    };
    const onFocusOut = (e: FocusEvent) => {
      clear();
      const next = e.relatedTarget as Node | null;
      if (!(box.current && next && box.current.contains(next))) setOpen(null);
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("click", onClick, true);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      clear();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  if (!open) return null;

  const W = 288;
  const margin = 8;
  const left = Math.min(
    Math.max(margin, open.rect.left + open.rect.width / 2 - W / 2),
    window.innerWidth - W - margin,
  );
  const below = open.rect.bottom + 150 < window.innerHeight;
  const style: React.CSSProperties = below
    ? { left, top: open.rect.bottom + 8, width: W }
    : { left, bottom: window.innerHeight - open.rect.top + 8, width: W };

  const r = open.rect;
  const pad = 4;
  const arrowLeft = Math.min(Math.max(16, r.left + r.width / 2 - left - 6), W - 28);

  return (
    <>
      {/* Destaque: escurece o resto e circunda o botão, como num tour guiado */}
      {(() => {
        const x1 = r.left - pad;
        const y1 = r.top - pad;
        const x2 = r.right + pad;
        const y2 = r.bottom + pad;
        const dim = "pointer-events-none fixed z-40";
        const shade = { background: "rgba(0,0,0,0.45)" };
        return (
          <>
            <div
              aria-hidden="true"
              className={dim}
              style={{ left: 0, top: 0, right: 0, height: Math.max(0, y1), ...shade }}
            />
            <div
              aria-hidden="true"
              className={dim}
              style={{ left: 0, top: y2, right: 0, bottom: 0, ...shade }}
            />
            <div
              aria-hidden="true"
              className={dim}
              style={{ left: 0, top: y1, width: Math.max(0, x1), height: y2 - y1, ...shade }}
            />
            <div
              aria-hidden="true"
              className={dim}
              style={{ left: x2, top: y1, right: 0, height: y2 - y1, ...shade }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-40 rounded-xl border-[3px] border-primary"
              style={{ left: x1, top: y1, width: x2 - x1, height: y2 - y1 }}
            />
          </>
        );
      })()}
      <div
        ref={box}
        role="dialog"
        aria-label={`Ajuda: ${open.entry.title}`}
        style={style}
        className="fixed z-50 space-y-2 rounded-2xl bg-card p-4 text-card-foreground shadow-xl"
      >
        <span
          aria-hidden="true"
          className="absolute h-3 w-3 rotate-45 bg-card"
          style={{ left: arrowLeft, ...(below ? { top: -6 } : { bottom: -6 }) }}
        />
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-base">{open.entry.title}</p>
          <button
            type="button"
            aria-label="Fechar ajuda"
            data-ajuda="Fechar"
            onClick={() => setOpen(null)}
            className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm">{open.entry.text}</p>
        <Link
          to="/ajuda"
          onClick={() => setOpen(null)}
          data-ajuda="Ajuda"
          className="inline-block rounded-md border-2 border-foreground bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground"
        >
          Mais ajuda
        </Link>
      </div>
    </>
  );
}
