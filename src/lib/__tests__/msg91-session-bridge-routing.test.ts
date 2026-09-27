import { describe, expect, it } from "vitest";
import { resolveMsg91SessionFunction } from "@/lib/msg91-session-bridge-routing";

describe("UAT #561 MSG91 session bridge routing", () => {
  it("routes only verify_widget through the additive session bridge", () => {
    expect(resolveMsg91SessionFunction("msg91-otp", { body: { mode: "verify_widget", accessToken: "test" } })).toBe(
      "msg91-session-bridge",
    );
  });

  it("leaves legacy MSG91 modes on the existing function", () => {
    expect(resolveMsg91SessionFunction("msg91-otp", { body: { mode: "login_otp" } })).toBe("msg91-otp");
    expect(resolveMsg91SessionFunction("msg91-otp", { body: { mode: "order_received" } })).toBe("msg91-otp");
  });

  it("leaves every unrelated Edge Function unchanged", () => {
    expect(resolveMsg91SessionFunction("whatsapp-webhook", { body: { mode: "verify_widget" } })).toBe("whatsapp-webhook");
    expect(resolveMsg91SessionFunction("msg91-otp")).toBe("msg91-otp");
  });
});
