import { describe, expect, it } from "vitest";
import {
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
});
