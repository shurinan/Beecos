import { permitsOrdinaryAds, updateGoogleAdConsent } from "@/lib/ad-consent";

/** Tag do Google Ads do Beecos (copiada do trecho que o Google Ads gerou). */
export const GOOGLE_ADS_ID = "AW-16550391468";

/** Resultados do anúncio que o app informa ao Google Ads. */
export type AdOutcome = "signup" | "post" | "chat";

/**
 * Como cada conversão chega ao Google Ads. Duas formas, conforme o trecho que o Google Ads gerou:
 * - { event: "ads_conversion_..." }: trecho gtag('event', 'ads_conversion_...');
 * - { label: "ROTULO" }: trecho com send_to: "AW-16550391468/ROTULO".
 * Sem nada (null), nada é enviado para aquele resultado.
 */
export type ConversionTarget = { event: string } | { label: string };
export const CONVERSIONS: Record<AdOutcome, ConversionTarget | null> = {
  signup: { event: "ads_conversion_Inscri_o_1" }, // cadastro concluído ("Inscrição" no Google Ads)
  post: null, // publicação criada (vaga ou anúncio de disponível)
  chat: null, // conversa aberta pelo chat
};

function hasPrivacySignal(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

/** Carrega a tag uma vez, só quando a publicidade é permitida (aviso aceito ou fora das regiões com aviso). */
export async function loadGoogleAds(): Promise<boolean> {
  if (typeof window === "undefined" || hasPrivacySignal()) return false;
  const allowed = await permitsOrdinaryAds();
  if (!allowed) return false;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  updateGoogleAdConsent("granted");
  if (document.querySelector("script[data-google-ads]")) return true;
  window.gtag("set", "developer_id.dZjgwMW", true);
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
  const script = document.createElement("script");
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GOOGLE_ADS_ID);
  script.async = true;
  script.dataset["googleAds"] = "";
  document.head.appendChild(script);
  return true;
}

/** Visita a outra tela do app (o carregamento inicial já conta pela própria tag). */
export async function reportPageView(path: string): Promise<void> {
  if (!(await loadGoogleAds())) return;
  window.gtag?.("event", "page_view", {
    send_to: GOOGLE_ADS_ID,
    page_path: path,
    page_location: window.location.origin + path,
  });
}

/** Informa um resultado que acabou de dar certo. Não faz nada sem conversão configurada ou sem permissão. */
export async function reportConversion(outcome: AdOutcome): Promise<boolean> {
  const target = CONVERSIONS[outcome];
  if (!target) return false;
  if (!(await loadGoogleAds())) return false;
  // confere de novo: a pessoa pode ter recusado enquanto a tag carregava
  if (!(await permitsOrdinaryAds())) return false;
  if ("event" in target) window.gtag?.("event", target.event, {});
  else window.gtag?.("event", "conversion", { send_to: `${GOOGLE_ADS_ID}/${target.label}` });
  return true;
}

const SIGNUP_FLAG = "beecos-ads-signup-";

/** Cadastro: conta uma vez por conta neste aparelho. */
export function reportSignupOnce(userId: string): void {
  try {
    if (localStorage.getItem(SIGNUP_FLAG + userId)) return;
    localStorage.setItem(SIGNUP_FLAG + userId, "1");
  } catch {
    // sem armazenamento: segue e informa assim mesmo
  }
  void reportConversion("signup");
}

/** Conta criada agora há pouco (para quem entrou com o Google pela primeira vez). */
export function isFreshAccount(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && now - t >= 0 && now - t < 10 * 60_000;
}
