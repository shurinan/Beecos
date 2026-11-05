import { useCallback, useEffect, useState } from "react";

/**
 * Som de notificação do Beecos ("Martelinho": duas batidinhas secas). É gerado na hora pelo
 * navegador, sem arquivo de áudio. Vale para mensagem nova e aviso de vaga, com o app aberto.
 * Ligar ou desligar fica guardado neste aparelho.
 */
export const SOUND_KEY = "beecos-som";
const SOUND_EVENT = "beecos-som-change";
/** Duas notificações seguidas (ex.: mensagem e aviso juntos) tocam uma vez só. */
const MIN_GAP_MS = 1500;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, "off");
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  window.dispatchEvent(new Event(SOUND_EVENT));
}

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let lastPlayed = 0;

function audio(): Ctx | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/**
 * O navegador só libera som depois de um toque na tela. No primeiro toque, o som fica pronto
 * para as próximas notificações.
 */
export function unlockSoundOnFirstTouch() {
  if (typeof window === "undefined") return () => undefined;
  const unlock = () => {
    const c = audio();
    if (c && c.state === "suspended") void c.resume();
  };
  const opts = { capture: true, passive: true } as const;
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("keydown", unlock, opts);
  return () => {
    window.removeEventListener("pointerdown", unlock, opts);
    window.removeEventListener("keydown", unlock, opts);
  };
}

function knock(c: Ctx, t: number) {
  const len = 0.06;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
  const src = c.createBufferSource();
  src.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800;
  band.Q.value = 2;
  const g = c.createGain();
  g.gain.value = 0.9;
  src.connect(band).connect(g).connect(c.destination);
  src.start(t);
  // um tom curto por baixo dá corpo à batida
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(520, t);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 0.09);
}

/** Toca o Martelinho, se o som estiver ligado e o navegador já tiver liberado. */
export function playNotificationSound() {
  if (!soundEnabled()) return;
  const now = Date.now();
  if (now - lastPlayed < MIN_GAP_MS) return;
  const c = audio();
  if (!c || c.state !== "running") return; // ainda sem toque na tela: chega sem som
  lastPlayed = now;
  try {
    const t = c.currentTime + 0.02;
    knock(c, t);
    knock(c, t + 0.13);
  } catch {
    /* sem som neste aparelho */
  }
}

/** Para o botão "Som" nas preferências: acompanha a mudança feita em outra tela. */
export function useSoundPref() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(soundEnabled());
    const sync = () => setOn(soundEnabled());
    window.addEventListener(SOUND_EVENT, sync);
    return () => window.removeEventListener(SOUND_EVENT, sync);
  }, []);
  const choose = useCallback((next: boolean) => {
    setSoundEnabled(next);
    setOn(next);
    if (next) {
      // toca na hora para a pessoa ouvir como ficou (o toque no botão já libera o som)
      const c = audio();
      if (c && c.state === "suspended") void c.resume().then(playNotificationSound);
      else playNotificationSound();
    }
  }, []);
  return { on, choose };
}
