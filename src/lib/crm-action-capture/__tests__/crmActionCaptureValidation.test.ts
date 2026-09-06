import { describe, expect, it } from "vitest";
import { buildCaptureRow } from "../crmActionCaptureClient";
import {
  captureFailure,
  validateEmailIntentInput,
  validateManualActionInput,
  validateWhatsAppProviderInput,
} from "../crmActionCaptureValidation";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const EXEC_ID = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";

describe("crmActionCaptureValidation", () => {
  it("requires actor and company binding", () => {
    expect(
      validateManualActionInput({
        companyId: COMPANY_ID,
        executiveId: "",
        channel: "call",
        notes: "hello",
      }),
    ).toMatchObject({ ok: false, failure: "missing_actor" });

    expect(
      validateManualActionInput({
        companyId: "not-a-uuid",
        executiveId: EXEC_ID,
        channel: "call",
        notes: "hello",
      }),
    ).toMatchObject({ ok: false, failure: "invalid_company_id" });
  });

  it("enforces roster authorization", () => {
    const result = validateManualActionInput({
      companyId: COMPANY_ID,
      executiveId: EXEC_ID,
      channel: "call",
      notes: "hello",
      authorizedCompanyIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    });
    expect(result).toMatchObject({ ok: false, failure: "unauthorized_company" });
  });

  it("requires follow-up date for promises", () => {
    const result = validateManualActionInput({
      companyId: COMPANY_ID,
      executiveId: EXEC_ID,
      channel: "promise",
      notes: "Will deliver samples",
    });
    expect(result).toMatchObject({ ok: false, failure: "missing_follow_up_date" });
  });

  it("rejects direct manual email capture", () => {
    const result = validateManualActionInput({
      companyId: COMPANY_ID,
      executiveId: EXEC_ID,
      channel: "email",
      notes: "Draft",
    });
    expect(result).toMatchObject({ ok: false, failure: "provider_unavailable" });
  });

  it("allows email intent validation", () => {
    expect(
      validateEmailIntentInput({
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        subject: "Quote follow-up",
        body: "Please review attached quote.",
      }),
    ).toBeNull();
  });

  it("never invents WhatsApp provider success without recipient", () => {
    const result = validateWhatsAppProviderInput({
      companyId: COMPANY_ID,
      executiveId: EXEC_ID,
      to: "",
      message: "Hello",
    });
    expect(result).toMatchObject({ ok: false, failure: "provider_unavailable" });
  });

  it("builds governed rows with provenance and delivery separation", () => {
    const row = buildCaptureRow({
      input: {
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        channel: "promise",
        notes: "Committed to dispatch by Friday",
        followUpDate: "2026-03-10",
      },
      deliveryState: "not_applicable",
      source: "manual",
      idempotencyKey: "idem-xyz",
    });
    expect(row.company_id).toBe(COMPANY_ID);
    expect(row.interaction_type).toBe("promise");
    expect(row.notes).toContain("|idem=idem-xyz");
    expect(row.follow_up_date).toBe("2026-03-10");
  });

  it("maps intent-only email delivery to outcome without claiming send", () => {
    const row = buildCaptureRow({
      input: {
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        channel: "email",
        notes: "Subject: Follow up",
      },
      deliveryState: "intent_only",
      source: "intent_only",
      idempotencyKey: "email-1",
    });
    expect(row.outcome).toBe("intent_only");
    expect(row.notes).toContain("delivery=intent_only");
  });

  it("exposes captureFailure helper", () => {
    expect(captureFailure("insert_failed", "boom").ok).toBe(false);
  });
});
