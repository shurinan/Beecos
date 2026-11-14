import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const permits = vi.fn<() => Promise<boolean>>();
vi.mock("@/lib/ad-consent", () => ({
  permitsOrdinaryAds: () => permits(),
  updateGoogleAdConsent: vi.fn(),
}));

import { CONVERSION_LABELS, GOOGLE_ADS_ID, isFreshAccount, reportConversion } from "./google-ads";

describe("Google Ads tag", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    window.dataLayer = [];
    window.gtag = vi.fn();
    CONVERSION_LABELS.signup = null;
  });
  afterEach(() => vi.clearAllMocks());

  it("uses the tag ID the user gave", () => {
    expect(GOOGLE_ADS_ID).toBe("AW-16550391468");
  });

  it("sends nothing for a result without a conversion label", async () => {
    permits.mockResolvedValue(true);
    expect(await reportConversion("signup")).toBe(false);
    expect(window.gtag).not.toHaveBeenCalledWith("event", "conversion", expect.anything());
  });

  it("sends nothing when advertising was refused", async () => {
    CONVERSION_LABELS.signup = "TESTE";
    permits.mockResolvedValue(false);
    expect(await reportConversion("signup")).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
    expect(document.querySelector("script[data-google-ads]")).toBeNull();
  });

  it("sends the conversion to the right label when allowed", async () => {
    CONVERSION_LABELS.signup = "TESTE";
    permits.mockResolvedValue(true);
    expect(await reportConversion("signup")).toBe(true);
    expect(window.gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-16550391468/TESTE",
    });
  });
});

describe("isFreshAccount", () => {
  const now = Date.parse("2026-11-14T00:00:00Z");
  it("counts an account created less than 10 minutes ago as new", () => {
    expect(isFreshAccount("2026-11-13T23:55:00Z", now)).toBe(true);
  });
  it("does not count an older account (a returning login)", () => {
    expect(isFreshAccount("2026-11-13T23:40:00Z", now)).toBe(false);
    expect(isFreshAccount(undefined, now)).toBe(false);
  });
});
