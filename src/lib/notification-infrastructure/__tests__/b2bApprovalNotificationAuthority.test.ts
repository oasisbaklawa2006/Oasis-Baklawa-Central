import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateNotifyEventParams } from "../notifyEventValidation";

const adminSource = readFileSync("src/pages/admin/AdminClients.tsx", "utf8");

describe("B2B approval notification authority", () => {
  it("accepts only application identity for approval fanout", () => {
    expect(validateNotifyEventParams({
      event: "approval_granted",
      applicationId: "10000000-0000-4000-8000-000000000001",
    })).toEqual({ ok: true });
  });

  it("rejects caller-supplied approval message or recipient authority", () => {
    expect(validateNotifyEventParams({
      event: "approval_granted",
      applicationId: "10000000-0000-4000-8000-000000000001",
      email: "buyer@example.com",
    })).toEqual({ ok: false, reason: "approval_payload_must_use_application_authority" });
  });

  it("binds AdminClients to the application-only approval notification contract", () => {
    const approvalNotifyStart = adminSource.indexOf("const approvalNotification = await notifyEvent({");
    const approvalNotifyEnd = adminSource.indexOf("}, { timeoutMs: 10_000 });", approvalNotifyStart);
    const approvalNotifyBlock = adminSource.slice(approvalNotifyStart, approvalNotifyEnd);

    expect(adminSource).toContain('event: "approval_granted"');
    expect(adminSource).toContain("applicationId: app.id");
    expect(adminSource).not.toContain('subject: "Welcome to Oasis B2B! Your account is active"');
    expect(approvalNotifyBlock).not.toMatch(/\bemail:\s*app\.contact_email/);
    expect(adminSource).toContain("{ timeoutMs: 10_000 }");
  });
});
