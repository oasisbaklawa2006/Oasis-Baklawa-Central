import { describe, expect, it } from "vitest";
import { extractEdgeFunctionErrorCode } from "@/lib/edge-function-errors";
import { mapBuyerOtpProviderError } from "@/lib/buyer-login-errors";

describe("edge-function-errors / msg91 invoke failures", () => {
  it("preserves structured Edge error codes from FunctionsHttpError response bodies", async () => {
    const response = new Response(JSON.stringify({ ok: false, error: "duplicate_phone_identity" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
    const code = await extractEdgeFunctionErrorCode({
      data: null,
      error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        name: "FunctionsHttpError",
        context: response,
      }),
      response,
    });
    expect(code).toBe("duplicate_phone_identity");
    expect(mapBuyerOtpProviderError(code)).toContain("more than one account");
  });

  it("reads provider error codes from ok:false invoke data", async () => {
    const code = await extractEdgeFunctionErrorCode({
      data: { ok: false, error: "ambiguous_phone_identity" },
      error: null,
    });
    expect(code).toBe("ambiguous_phone_identity");
    expect(mapBuyerOtpProviderError(code)).toContain("reconciliation");
  });

  it("ignores generic invoke wrapper messages when the body cannot be parsed", async () => {
    const code = await extractEdgeFunctionErrorCode({
      data: null,
      error: new Error("Edge Function returned a non-2xx status code"),
    });
    expect(code).toBeNull();
  });
});
