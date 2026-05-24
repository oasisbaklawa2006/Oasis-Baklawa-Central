import { describe, expect, it } from "vitest";
import {
  buildNotificationProjectionCatalog,
  filterNotificationProjectionsBySource,
  filterNotificationProjectionsBySeverity,
} from "@/lib/notifications/notificationProjection";

describe("buildNotificationProjectionCatalog", () => {
  it("uses deterministic ids per topic", () => {
    const rows = buildNotificationProjectionCatalog({});
    const ids = rows.map((r) => r.id).sort();
    expect(ids[0]).toBe("notif-proj:approval_pending");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks every row as visibility-only projection", () => {
    const rows = buildNotificationProjectionCatalog({});
    expect(rows.every((r) => r.visibilityOnly === true)).toBe(true);
  });

  it("embeds bounded finance hint when financePressureOrders provided", () => {
    const rows = buildNotificationProjectionCatalog({ financePressureOrders: 4 });
    const finance = rows.find((r) => r.topic === "finance_pending");
    expect(finance?.signalHint).toContain("4");
  });

  it("filters by source and severity", () => {
    const rows = buildNotificationProjectionCatalog({});
    const financeOnly = filterNotificationProjectionsBySource(rows, "finance");
    expect(financeOnly.every((r) => r.source === "finance")).toBe(true);
    const urgentOnly = filterNotificationProjectionsBySeverity(rows, "urgent");
    expect(urgentOnly.length).toBeGreaterThan(0);
    expect(urgentOnly.every((r) => ["dispatch_delayed", "whatsapp_stale", "approval_pending"].includes(r.topic))).toBe(true);
  });
});
