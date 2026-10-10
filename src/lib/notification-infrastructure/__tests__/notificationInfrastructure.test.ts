import { describe, expect, it } from "vitest";
import { buildNotificationDedupeKey, normalizeDedupeRecipientKey } from "../dedupeIdentity";
import {
  hasProviderDeliveryEvidence,
  normalizeInAppReadState,
  normalizeOutboxDeliveryState,
  outboxDeliveryLabel,
  projectInAppNotification,
  projectOutboxDelivery,
} from "../deliveryState";
import { assertRecipientIsolation, inboxScopeMatchesRow, resolveInboxRecipientScope } from "../recipientScope";
import { adviseOutboxRetry, POINT24_RETRY_AUTHORITY } from "../retryDelegation";
import { validateNotifyEventParams } from "../notifyEventValidation";

describe("notification infrastructure contract (Point21)", () => {
  const scope = { userId: "user-1", companyId: "company-1" };

  describe("recipient scope", () => {
    it("fails closed without user id", () => {
      expect(resolveInboxRecipientScope({ userId: null })).toEqual({
        ok: false,
        reason: "unresolved_user_id",
      });
    });

    it("resolves user and optional company scope", () => {
      expect(resolveInboxRecipientScope({ userId: "u1", companyId: "c1" })).toEqual({
        ok: true,
        scope: { userId: "u1", companyId: "c1" },
      });
    });

    it("enforces recipient isolation", () => {
      expect(() =>
        assertRecipientIsolation(scope, [{ id: "n1", user_id: "other-user", company_id: null }]),
      ).toThrow(/recipient_isolation/);
    });

    it("allows user-targeted and company-broadcast rows", () => {
      expect(inboxScopeMatchesRow(scope, { user_id: "user-1", company_id: null })).toBe(true);
      expect(inboxScopeMatchesRow(scope, { user_id: null, company_id: "company-1" })).toBe(true);
      expect(inboxScopeMatchesRow(scope, { user_id: "other", company_id: "company-1" })).toBe(false);
    });
  });

  describe("dedupe identity", () => {
    it("builds deterministic keys", () => {
      const key = buildNotificationDedupeKey({
        channel: "email",
        eventKey: "order_confirmed",
        recipientKey: "user:abc",
        entityRef: "order:123",
      });
      expect(key).toBe("email:order_confirmed:user:abc:order:123");
      expect(
        buildNotificationDedupeKey({
          channel: "email",
          eventKey: "ORDER_CONFIRMED",
          recipientKey: "USER:ABC",
          entityRef: "order:123",
        }),
      ).toBe(key);
    });

    it("normalizes recipient keys fail-closed", () => {
      expect(normalizeDedupeRecipientKey({})).toBeNull();
      expect(normalizeDedupeRecipientKey({ email: "a@b.com" })).toBe("email:a@b.com");
    });
  });

  describe("delivery state", () => {
    it("never claims sent without sent_at evidence", () => {
      expect(normalizeOutboxDeliveryState({ status: "sent", sent_at: null })).toBe("pending");
      expect(hasProviderDeliveryEvidence({ status: "sent", sent_at: null })).toBe(false);
      expect(hasProviderDeliveryEvidence({ status: "sent", sent_at: "2026-01-01T00:00:00Z" })).toBe(true);
    });

    it("projects in-app read state", () => {
      const record = projectInAppNotification({
        id: "n1",
        type: "alert",
        message: "hello",
        created_at: "2026-01-01",
        is_read: false,
        user_id: "user-1",
        company_id: null,
      });
      expect(record.readState).toBe("unread");
      expect(normalizeInAppReadState(true)).toBe("read");
    });

    it("labels outbox without false delivery claim", () => {
      const pending = projectOutboxDelivery({
        id: "o1",
        event_type: "wallet_credited",
        message_body: "credited",
        recipient_email: "a@b.com",
        recipient_phone: null,
        priority: "normal",
        status: "sent",
        sent_at: null,
        error_log: null,
        created_at: "2026-01-01",
      });
      expect(pending.providerDeliveryEvident).toBe(false);
      expect(outboxDeliveryLabel(pending)).toBe("pending");
    });
  });

  describe("retry delegation (Point24)", () => {
    it("delegates failed rows to Core retry authority", () => {
      const failed = projectOutboxDelivery({
        id: "o2",
        event_type: "x",
        message_body: "m",
        recipient_email: null,
        recipient_phone: null,
        priority: "normal",
        status: "failed",
        sent_at: null,
        error_log: "provider error",
        created_at: null,
      });
      expect(adviseOutboxRetry(failed)).toEqual({
        action: "delegate_point24",
        reason: "failed_outbox_requires_core_retry_or_dead_letter_policy",
        authority: POINT24_RETRY_AUTHORITY,
      });
    });

    it("does not retry evidenced delivery", () => {
      const sent = projectOutboxDelivery({
        id: "o3",
        event_type: "x",
        message_body: "m",
        recipient_email: "a@b.com",
        recipient_phone: null,
        priority: "normal",
        status: "sent",
        sent_at: "2026-01-01T00:00:00Z",
        error_log: null,
        created_at: null,
      });
      expect(adviseOutboxRetry(sent).action).toBe("none");
    });
  });

  describe("notify-event validation", () => {
    it("fails closed on unresolved recipient scope", () => {
      expect(
        validateNotifyEventParams({
          event: "order_confirmed",
          subject: "s",
          message: "m",
        }),
      ).toEqual({ ok: false, reason: "unresolved_recipient_scope" });
    });

    it("accepts order context with audiences", () => {
      expect(
        validateNotifyEventParams({
          event: "order_confirmed",
          subject: "s",
          message: "m",
          audiences: ["buyer"],
          orderId: "order-1",
        }),
      ).toEqual({ ok: true });
    });
  });
});
