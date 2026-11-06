import { supabase } from "@/integrations/supabase/client";
import { isIos, isStandalone } from "@/lib/pwa";

/**
 * Avisos do sistema (barra de notificações) mesmo com o Beecos fechado: Web Push.
 * A pessoa autoriza uma vez por aparelho; o servidor (função send-push) manda mensagem nova,
 * vaga nova e os outros avisos do sino.
 */

export type PushState =
  | "unsupported" // navegador sem suporte
  | "ios-install" // iPhone: só funciona com o app instalado na tela de início
  | "denied" // a pessoa bloqueou nas configurações do navegador
  | "off" // ainda não autorizou neste aparelho
  | "on";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Converte a chave pública (base64url) no formato que o navegador pede. */
export function keyToBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // o service worker pode ainda estar instalando: espera um pouco
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 6000)),
  ]);
}

export async function getPushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

async function save(userId: string, sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error("inscrição incompleta");
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: j.endpoint,
    user_id: userId,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  });
  if (error) throw error;
}

async function subscribe(userId: string): Promise<boolean> {
  const reg = await registration();
  if (!reg) return false;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data: key, error } = await supabase.rpc("vapid_public_key");
    if (error || !key) return false;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(key) as BufferSource,
    });
  }
  await save(userId, sub);
  return true;
}

/** Botão "Ativar avisos": pede a permissão e inscreve este aparelho. */
export async function enablePush(userId: string): Promise<PushState> {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  try {
    return (await subscribe(userId)) ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Ao abrir o app: se já autorizou, garante a inscrição deste aparelho (sem perguntar nada). */
export async function syncPush(userId: string) {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    await subscribe(userId);
  } catch {
    /* tenta de novo na próxima vez */
  }
}

/** Desliga os avisos neste aparelho. */
export async function disablePush() {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<boolean> {
  const { data, error } = await supabase.rpc("send_test_push");
  if (error) throw error;
  return !!data;
}
