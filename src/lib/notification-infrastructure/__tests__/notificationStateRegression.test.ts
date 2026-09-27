import { describe, expect, it } from "vitest";
import {
  hasProviderDeliveryEvidence,
  normalizeInAppReadState,
  normalizeOutboxDeliveryState,
  outboxDeliveryLabel,
  projectInAppNotification,
  projectOutboxDelivery,
} from "../deliveryState";
import { assertRecipientIsolation, inboxScopeMatchesRow } from "../recipientScope";
import { projectOutboxRows } from "../outboxDeliveryView";
import { adviseOutboxRetry } from "../retryDelegation";

/**
 * Synthetic regression matrix for Point21 read/delivery state.
 * Guards against split-brain inbox, false delivery claims, and recipient leaks.
 */
describe("Point21 synthetic regression — in-app read state", () => {
  const readMatrix: Array<{ is_read: boolean | null; expected: "read" | "unread" }> = [
    { is_read: null, expected: "unread" },
    { is_read: false, expected: "unread" },
    { is_read: true, expected: "read" },
  ];

  it.each(readMatrix)("is_read=$is_read projects to $expected", ({ is_read, expected }) => {
    expect(normalizeInAppReadState(is_read)).toBe(expected);
    const record = projectInAppNotification({
      id: "syn-read-1",
      type: "payment_request",
      message: "synthetic",
      created_at: "2026-09-06T10:00:00Z",
      is_read,
      user_id: "user-a",
      company_id: null,
    });
    expect(record.readState).toBe(expected);
  });

  it("regression: unread count scope excludes foreign user rows", () => {
    const scope = { userId: "user-a", companyId: "company-a" };
    const syntheticInbox = [
      { id: "1", user_id: "user-a", company_id: null, is_read: false },
      { id: "2", user_id: null, company_id: "company-a", is_read: false },
      { id: "3", user_id: "user-b", company_id: "company-a", is_read: false },
      { id: "4", user_id: null, company_id: "company-b", is_read: false },
    ];

    const visible = syntheticInbox.filter((row) => inboxScopeMatchesRow(scope, row));
    expect(visible.map((r) => r.id)).toEqual(["1", "2"]);
    assertRecipientIsolation(scope, visible);
  });

  it("regression: mark-read transition unread → read", () => {
    const before = projectInAppNotification({
      id: "n-transition",
      type: "alert",
      message: "before",
      created_at: "2026-09-06T10:00:00Z",
      is_read: false,
      user_id: "user-a",
      company_id: null,
    });
    const after = projectInAppNotification({
      ...{
        id: before.id,
        type: before.type,
        message: before.message,
        created_at: before.createdAt,
        user_id: before.userId,
        company_id: before.companyId,
      },
      is_read: true,
    });
    expect(before.readState).toBe("unread");
    expect(after.readState).toBe("read");
  });

  it("regression: mark-read targets only displayed unread rows", () => {
    const displayed = [
      projectInAppNotification({
        id: "visible-unread",
        type: "alert",
        message: "shown",
        created_at: "2026-09-06T10:00:00Z",
        is_read: false,
        user_id: "user-a",
        company_id: null,
      }),
      projectInAppNotification({
        id: "visible-read",
        type: "alert",
        message: "already read",
        created_at: "2026-09-06T09:00:00Z",
        is_read: true,
        user_id: "user-a",
        company_id: null,
      }),
    ];
    const unreadIds = displayed.filter((row) => row.readState === "unread").map((row) => row.id);
    expect(unreadIds).toEqual(["visible-unread"]);
  });
});

describe("Point21 synthetic regression — outbox delivery state", () => {
  const deliveryMatrix: Array<{
    status: string | null;
    sent_at: string | null;
    deliveryState: "pending" | "sent" | "failed";
    evident: boolean;
    label: string;
  }> = [
    { status: "pending", sent_at: null, deliveryState: "pending", evident: false, label: "pending" },
    { status: "sent", sent_at: null, deliveryState: "pending", evident: false, label: "pending" },
    {
      status: "sent",
      sent_at: "2026-09-06T10:05:00Z",
      deliveryState: "sent",
      evident: true,
      label: "sent",
    },
    { status: "failed", sent_at: null, deliveryState: "failed", evident: false, label: "failed" },
    { status: "SENT", sent_at: "2026-09-06T10:05:00Z", deliveryState: "sent", evident: true, label: "sent" },
  ];

  it.each(deliveryMatrix)(
    "status=$status sent_at=$sent_at → delivery=$deliveryState evident=$evident",
    ({ status, sent_at, deliveryState, evident, label }) => {
      expect(normalizeOutboxDeliveryState({ status, sent_at })).toBe(deliveryState);
      expect(hasProviderDeliveryEvidence({ status, sent_at })).toBe(evident);

      const projected = projectOutboxDelivery({
        id: "syn-outbox",
        event_type: "advance_requested",
        message_body: "synthetic outbox",
        recipient_email: "buyer@example.com",
        recipient_phone: null,
        priority: "high",
        status,
        sent_at,
        error_log: status === "failed" ? "provider_timeout" : null,
        created_at: "2026-09-06T10:00:00Z",
      });
      expect(projected.deliveryState).toBe(deliveryState);
      expect(projected.providerDeliveryEvident).toBe(evident);
      expect(outboxDeliveryLabel(projected)).toBe(label);
    },
  );

  it("regression: invoke-only success without sent_at must not increment processed count semantics", () => {
    const invokeOnlySuccess = projectOutboxDelivery({
      id: "o-invoke-only",
      event_type: "wallet_credited",
      message_body: "edge invoke returned 200",
      recipient_email: "a@b.com",
      recipient_phone: null,
      priority: "normal",
      status: "sent",
      sent_at: null,
      error_log: null,
      created_at: "2026-09-06T10:00:00Z",
    });
    expect(invokeOnlySuccess.providerDeliveryEvident).toBe(false);
    expect(hasProviderDeliveryEvidence({ status: "sent", sent_at: null })).toBe(false);
    expect(adviseOutboxRetry(invokeOnlySuccess).action).toBe("none");
  });

  it("regression: admin outbox projection batch preserves evidence rules", () => {
    const rows = projectOutboxRows([
      {
        id: "1",
        event_type: "a",
        message_body: "m1",
        recipient_email: "a@b.com",
        recipient_phone: null,
        priority: "normal",
        status: "sent",
        sent_at: "2026-09-06T10:00:00Z",
        error_log: null,
        created_at: "2026-09-06T09:00:00Z",
      },
      {
        id: "2",
        event_type: "b",
        message_body: "m2",
        recipient_email: "c@d.com",
        recipient_phone: null,
        priority: "normal",
        status: "sent",
        sent_at: null,
        error_log: null,
        created_at: "2026-09-06T09:01:00Z",
      },
    ]);
    expect(rows[0].providerDeliveryEvident).toBe(true);
    expect(rows[1].providerDeliveryEvident).toBe(false);
    expect(outboxDeliveryLabel(rows[1])).toBe("pending");
  });
});
