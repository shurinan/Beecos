import { useCallback, useEffect, useState } from "react";

/** Tema do app: segue o sistema por padrão; a pessoa pode fixar claro ou escuro. */
export type ThemePref = "system" | "light" | "dark";
export const THEME_KEY = "beecos-theme";
const THEME_EVENT = "beecos-theme-change";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): "light" | "dark" {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemePref(v) ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref: ThemePref) {
  const resolved = resolveTheme(pref, systemDark());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

/**
 * Roda no <head>, antes de desenhar a página, para o tema certo aparecer já no primeiro quadro
 * (sem piscar claro e depois escuro). Mantém a mesma lógica de readPref/applyTheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;if(d)e.classList.add("dark");e.style.colorScheme=d?"dark":"light"}catch(_){}})()`;

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const p = readPref();
    setPref(p);
    setResolved(applyTheme(p));
  }, []);

  // outro ponto do app (o botão do cabeçalho) mudou o tema: acompanha
  useEffect(() => {
    const sync = () => {
      const p = readPref();
      setPref(p);
      setResolved(applyTheme(p));
    };
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  // com "sistema", acompanha a mudança do aparelho na hora (ex.: escurece ao anoitecer)
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = useCallback((next: ThemePref) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
    setPref(next);
    setResolved(applyTheme(next));
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { pref, resolved, choose };
}
