import { beforeEach, describe, expect, it, vi } from "vitest";

const confirmMock = vi.fn();
const insertMock = vi.fn();
const queueMock = vi.fn();

vi.mock("@/lib/order-authority/orderAuthorityClient", () => ({
  confirmPrepaidOrderAwaitingAdvance: (...args: unknown[]) => confirmMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "notifications") throw new Error(`unexpected table ${table}`);
      return { insert: insertMock };
    },
  },
}));

vi.mock("@/utils/notificationOutbox", () => ({
  queueNotification: (...args: unknown[]) => queueMock(...args),
}));

import {
  deliverAdvancePaymentRequestNotifications,
  executeGovernedAdvanceRequest,
} from "../financeAdvanceNotificationBridge";

describe("financeAdvanceNotificationBridge", () => {
  beforeEach(() => {
    confirmMock.mockReset();
    insertMock.mockReset();
    queueMock.mockReset();
  });

  it("reports notification failures without throwing after transition commits", async () => {
    confirmMock.mockResolvedValue({ ok: true, already_applied: false });
    insertMock.mockResolvedValue({ error: { message: "notifications down" } });
    queueMock.mockResolvedValue({ queued: false, reason: "outbox rejected" });

    const result = await executeGovernedAdvanceRequest({
      orderId: "order-1",
      companyId: "company-1",
      message: "Please upload advance",
    });

    expect(result.transitionCommitted).toBe(true);
    expect(result.notifications.failures).toEqual([
      "in-app notification: notifications down",
      "outbox: outbox rejected",
    ]);
  });

  it("allows notification retry when transition is already applied", async () => {
    confirmMock.mockResolvedValue({ ok: true, already_applied: true });
    insertMock.mockResolvedValue({ error: null });
    queueMock.mockResolvedValue({ queued: true });

    const result = await executeGovernedAdvanceRequest({
      orderId: "order-1",
      companyId: "company-1",
      message: "Please upload advance",
    });

    expect(result.alreadyApplied).toBe(true);
    expect(result.notifications.inAppInserted).toBe(true);
    expect(result.notifications.outboxQueued).toBe(true);
    expect(result.notifications.failures).toHaveLength(0);
  });

  it("delivers in-app and outbox notifications independently", async () => {
    insertMock.mockResolvedValue({ error: null });
    queueMock.mockResolvedValue({ queued: true });

    const result = await deliverAdvancePaymentRequestNotifications({
      companyId: "company-1",
      message: "retry only notifications",
    });

    expect(result.inAppInserted).toBe(true);
    expect(result.outboxQueued).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({
      company_id: "company-1",
      type: "payment_request",
      message: "retry only notifications",
    });
    expect(queueMock).toHaveBeenCalledWith({
      eventType: "advance_requested",
      messageBody: "retry only notifications",
      priority: "high",
    });
  });
});
