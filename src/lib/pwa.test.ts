import { describe, expect, it } from "vitest";
import { shouldRegisterServiceWorker } from "./pwa";

describe("shouldRegisterServiceWorker", () => {
  it("registers only on the published site", () => {
    expect(
      shouldRegisterServiceWorker({ prod: true, inIframe: false, hostname: "beecos.lovable.app" }),
    ).toBe(true);
  });
  it("skips dev, iframes (editor preview) and preview hosts", () => {
    expect(
      shouldRegisterServiceWorker({ prod: false, inIframe: false, hostname: "beecos.lovable.app" }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({ prod: true, inIframe: true, hostname: "beecos.lovable.app" }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({
        prod: true,
        inIframe: false,
        hostname: "abc.lovableproject.com",
      }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({
        prod: true,
        inIframe: false,
        hostname: "id-preview--abc.lovable.app",
      }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({ prod: true, inIframe: false, hostname: "localhost" }),
    ).toBe(false);
  });
});
