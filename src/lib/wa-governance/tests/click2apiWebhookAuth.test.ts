import { describe, expect, it } from "vitest";
import { authenticateClick2ApiWebhook } from "../../../../supabase/functions/_shared/click2apiWebhookAuth";

const secret = "staging-contract-token";

describe("Click2API webhook authentication", () => {
  it("accepts the provider's configured echo query token", () => {
    const request = new Request(`https://example.test/whatsapp-webhook?source=click2api&echo=${secret}`, { method: "POST" });
    expect(authenticateClick2ApiWebhook(request, "different-header-secret", secret)).toEqual({ authenticated: true, source: "query" });
  });

  it("accepts the controlled-probe header contract", () => {
    const request = new Request("https://example.test/whatsapp-webhook", { method: "POST", headers: { "x-webhook-secret": secret } });
    expect(authenticateClick2ApiWebhook(request, secret)).toEqual({ authenticated: true, source: "header" });
  });

  it("accepts the alternate Click2API signature header", () => {
    const request = new Request("https://example.test/whatsapp-webhook", {
      method: "POST",
      headers: { "x-click2api-signature": secret },
    });
    expect(authenticateClick2ApiWebhook(request, secret)).toEqual({ authenticated: true, source: "header" });
  });

  it("rejects wrong-length tokens", () => {
    const request = new Request("https://example.test/whatsapp-webhook?echo=short", { method: "POST" });
    expect(authenticateClick2ApiWebhook(request, "different-header-secret", secret).authenticated).toBe(false);
  });

  it("rejects invalid authentication", () => {
    const request = new Request("https://example.test/whatsapp-webhook?echo=wrong", { method: "POST" });
    expect(authenticateClick2ApiWebhook(request, secret).authenticated).toBe(false);
  });

  it("rejects missing authentication and missing server configuration", () => {
    const request = new Request("https://example.test/whatsapp-webhook", { method: "POST" });
    expect(authenticateClick2ApiWebhook(request, secret).authenticated).toBe(false);
    expect(authenticateClick2ApiWebhook(request, undefined).authenticated).toBe(false);
  });
});
