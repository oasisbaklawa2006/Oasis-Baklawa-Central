import { describe, expect, it } from "vitest";
import {
  hasCentralEmailDeliveryChannel,
  selectEmailProcessablePendingBatch,
  shouldApplyPendingFailureUpdate,
  shouldSkipCentralEmailProcessing,
  validateOutboxRecipientForCentralQueue,
} from "../outboxQueueValidation";

describe("outbox queue validation (Point21)", () => {
  it("accepts email recipients for Central queue", () => {
    expect(
      validateOutboxRecipientForCentralQueue({
        recipientEmail: "buyer@example.com",
        recipientPhone: "+919999999999",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects phone-only recipients before insert", () => {
    expect(
      validateOutboxRecipientForCentralQueue({
        recipientPhone: "+919999999999",
      }),
    ).toEqual({ ok: false, reason: "phone_channel_unavailable_in_central" });
  });

  it("rejects unresolved recipients", () => {
    expect(validateOutboxRecipientForCentralQueue({})).toEqual({
      ok: false,
      reason: "unresolved_recipient",
    });
  });

  it("skips phone-only pending rows without failing them in Central processor", () => {
    expect(
      shouldSkipCentralEmailProcessing({
        recipient_email: null,
        recipient_phone: "+919999999999",
      }),
    ).toBe(true);
    expect(
      shouldSkipCentralEmailProcessing({
        recipient_email: "buyer@example.com",
        recipient_phone: "+919999999999",
      }),
    ).toBe(false);
  });

  it("regression: 50 phone-only rows do not starve a later email-capable row", () => {
    const phoneOnlyRows = Array.from({ length: 50 }, (_, index) => ({
      id: `phone-${index}`,
      recipient_email: null,
      recipient_phone: `+91999999${String(index).padStart(4, "0")}`,
    }));
    const emailRow = {
      id: "email-1",
      recipient_email: "buyer@example.com",
      recipient_phone: null,
    };
    const pending = [...phoneOnlyRows, emailRow];

    const starvedBatch = pending.slice(0, 50).filter(hasCentralEmailDeliveryChannel);
    expect(starvedBatch).toHaveLength(0);

    expect(selectEmailProcessablePendingBatch(pending, 50)).toEqual([emailRow]);
  });

  it("regression: transport failure must not overwrite evidenced delivery", () => {
    expect(
      shouldApplyPendingFailureUpdate({
        status: "sent",
        sent_at: "2026-09-06T10:05:00Z",
      }),
    ).toBe(false);
    expect(
      shouldApplyPendingFailureUpdate({
        status: "failed",
        sent_at: null,
      }),
    ).toBe(false);
    expect(
      shouldApplyPendingFailureUpdate({
        status: "pending",
        sent_at: null,
      }),
    ).toBe(true);
  });

  it("regression: non-pending terminal status blocks transport failure overwrite", () => {
    expect(
      shouldApplyPendingFailureUpdate({
        status: "sent",
        sent_at: null,
      }),
    ).toBe(false);
  });
});
