import { useEffect, useState } from "react";

/** Quanto precisa rolar numa direção para o menu mudar (evita piscar com tremidas do dedo). */
const STEP = 12;

/** Decide se o menu fica escondido, a partir da posição anterior e da nova. */
export function nextHidden(prevY: number, y: number, hidden: boolean): boolean {
  if (y <= 40) return false; // no topo, sempre aparece
  if (y - prevY > STEP) return true; // descendo a página: esconde
  if (prevY - y > STEP) return false; // subindo: mostra
  return hidden;
}

/**
 * Menu de baixo que some ao rolar a página para baixo e volta ao puxar para cima.
 * `active` = false mantém o menu sempre à vista.
 */
export function useHideOnScroll(active: boolean, resetKey: string) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(false), [resetKey]);
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const prev = last;
        if (Math.abs(y - prev) > STEP || y <= 40) {
          last = y;
          setHidden((h) => nextHidden(prev, y, h));
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [active]);
  return active && hidden;
}
