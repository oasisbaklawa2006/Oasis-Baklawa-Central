import { describe, expect, it } from "vitest";
import { classifyWhatsAppInvocationError, classifyWhatsAppSendResult } from "../whatsappSendResult";

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

  it("rejects bare success without provider message ID and prohibits replay", () => {
    expect(classifyWhatsAppSendResult({
      success: true,
      provider: "click2api",
    })).toMatchObject({
      success: false,
      acceptanceUnknown: true,
      error: "ACCEPTANCE_UNKNOWN",
    });
  });

  it("treats an explicit acceptance-unknown error as ambiguous even without a flag", () => {
    expect(classifyWhatsAppSendResult({
      success: false,
      error: "ACCEPTANCE_UNKNOWN",
    })).toMatchObject({ success: false, acceptanceUnknown: true });
  });

  it.each([new Error("Failed to fetch"), null, { name: "FunctionsHttpError" }])(
    "treats Edge Function invocation errors as ambiguous (%s)",
    async (error) => {
      await expect(classifyWhatsAppInvocationError(error)).resolves.toEqual({
        success: false,
        acceptanceUnknown: true,
        error: "ACCEPTANCE_UNKNOWN",
      });
    },
  );

  it("preserves an explicit rejection from a FunctionsHttpError response body", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      name: "FunctionsHttpError",
      context: new Response(JSON.stringify({
        success: false,
        error: "PROVIDER_MESSAGE_REJECTED",
      }), { status: 422, headers: { "Content-Type": "application/json" } }),
    });

    await expect(classifyWhatsAppInvocationError(error)).resolves.toMatchObject({
      success: false,
      error: "PROVIDER_MESSAGE_REJECTED",
    });
  });

  it("keeps an acceptance-unknown FunctionsHttpError body non-retryable", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      name: "FunctionsHttpError",
      context: new Response(JSON.stringify({
        success: false,
        acceptance_unknown: true,
        error: "ACCEPTANCE_UNKNOWN",
      }), { status: 502, headers: { "Content-Type": "application/json" } }),
    });

    await expect(classifyWhatsAppInvocationError(error)).resolves.toMatchObject({
      success: false,
      acceptanceUnknown: true,
      error: "ACCEPTANCE_UNKNOWN",
    });
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
        acceptanceUnknown: true,
        error: "INVALID_SEND_RESPONSE",
      });
    },
  );

  it("fails closed on successful-looking HTTP body without explicit accepted result", () => {
    expect(classifyWhatsAppSendResult({ provider: "click2api" }))
      .toMatchObject({ success: false, acceptanceUnknown: true, error: "SEND_NOT_CONFIRMED" });
  });
});
