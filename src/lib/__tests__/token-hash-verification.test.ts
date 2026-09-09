import { describe, expect, it } from "vitest";
import { normalizeProgrammaticTokenHashVerification } from "@/lib/token-hash-verification";

describe("programmatic Supabase TokenHash verification", () => {
  it("maps a magiclink TokenHash exchange to the documented email verification type", () => {
    const params = normalizeProgrammaticTokenHashVerification({
      token_hash: "test-token-hash",
      type: "magiclink",
      redirectTo: "https://example.test/after-auth",
    });

    expect(params).toEqual({
      token_hash: "test-token-hash",
      type: "email",
      redirectTo: "https://example.test/after-auth",
    });
  });

  it("does not alter non-magiclink verification modes", () => {
    const sms = { phone: "+919999999999", token: "123456", type: "sms" };
    expect(normalizeProgrammaticTokenHashVerification(sms)).toBe(sms);

    const recovery = { token_hash: "recovery-hash", type: "recovery" };
    expect(normalizeProgrammaticTokenHashVerification(recovery)).toBe(recovery);
  });
});
