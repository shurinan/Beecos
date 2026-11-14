import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { onConsentChange } from "@/lib/consent";
import { loadGoogleAds, reportPageView } from "@/lib/google-ads";

/** Liga a tag do Google Ads quando a publicidade é permitida e avisa as trocas de tela. */
export function GoogleAdsTag() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const first = useRef(true);

  useEffect(() => {
    void loadGoogleAds();
    return onConsentChange(() => void loadGoogleAds());
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false; // a primeira visita já conta quando a tag carrega
      return;
    }
    void reportPageView(path);
  }, [path]);

  return null;
}
