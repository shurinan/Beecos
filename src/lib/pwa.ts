/** Registra o service worker só no site publicado: nunca no preview do editor (dentro de iframe). */
export function shouldRegisterServiceWorker(env: {
  prod: boolean;
  inIframe: boolean;
  hostname: string;
}): boolean {
  if (!env.prod || env.inIframe) return false;
  return !/(^|\.)lovableproject\.com$|^id-preview--|^localhost$|^127\./.test(env.hostname);
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  if (
    !shouldRegisterServiceWorker({
      prod: import.meta.env.PROD,
      inIframe,
      hostname: window.location.hostname,
    })
  )
    return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* sem service worker o app funciona igual, só não instala/avisa em segundo plano */
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
