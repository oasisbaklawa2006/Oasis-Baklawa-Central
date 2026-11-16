import { describe, expect, it } from "vitest";
import { classifyWhatsAppSendResult } from "../whatsappSendResult";

describe("WA-100 Central consumer response truth", () => {
  it("accepts an explicit Core provider acceptance without claiming delivery", () => {
    expect(classifyWhatsAppSendResult({
      success: true,
      provider: "click2api",
      messageId: "wamid.test",
    })).toMatchObject({ success: true });
  });

  it("fails closed on HTTP-202 acceptance-unknown body; never licences retry", () => {
    expect(classifyWhatsAppSendResult({
      success: false,
      acceptance_unknown: true,
      error: "ACCEPTANCE_UNKNOWN",
    })).toMatchObject({
      success: false,
      acceptanceUnknown: true,
      error: "ACCEPTANCE_UNKNOWN",
    });
  });

  it("gives acceptance-unknown precedence over conflicting success flags", () => {
    expect(classifyWhatsAppSendResult({
      success: true,
      acceptance_unknown: true,
    })).toMatchObject({ success: false, acceptanceUnknown: true });
  });

  it("preserves explicit provider rejection", () => {
    expect(classifyWhatsAppSendResult({
      success: false,
      error: "PROVIDER_MESSAGE_REJECTED",
    })).toMatchObject({
      success: false,
      error: "PROVIDER_MESSAGE_REJECTED",
    });
  });

  it.each([null, undefined, [], true, "ok", 1])(
    "rejects malformed or missing Edge Function bodies (%s)",
    (body) => {
      expect(classifyWhatsAppSendResult(body)).toMatchObject({
        success: false,
        error: "INVALID_SEND_RESPONSE",
      });
    },
  );

  it("fails closed on successful-looking HTTP body without explicit accepted result", () => {
    expect(classifyWhatsAppSendResult({ provider: "click2api" }))
      .toMatchObject({ success: false, error: "SEND_NOT_CONFIRMED" });
  });
});
