import { describe, expect, it } from "vitest";
import { buildMediaOperationalFeed, countMediaManualVerificationProjections } from "@/lib/operational-events/mediaFeed";
import { buildNotificationOperationalFeed, countHighSeverityNotificationFeed } from "@/lib/operational-events/notificationFeed";
import { NotificationOperationalEventKind, MediaOperationalEventKind } from "@/lib/operational-events/types";
import { buildMediaVaultProjectionCatalog } from "@/lib/media-vault/mediaVaultProjection";

describe("buildNotificationOperationalFeed", () => {
  it("uses deterministic ids and null occurredAt for every row", () => {
    const events = buildNotificationOperationalFeed({
      financePressureOrders: 1,
      dispatchPanicOrders: 0,
      whatsappStalePackets: 2,
    });
    const ids = events.map((e) => e.id).sort();
    expect(ids[0]).toBe("notification-center:proj:approval_pending");
    expect(ids).toContain("notification-center:shell:visibility_only");
    expect(new Set(ids).size).toBe(ids.length);
    expect(events.every((e) => e.occurredAt === null)).toBe(true);
    expect(events.some((e) => e.kind === NotificationOperationalEventKind.VISIBILITY_ONLY)).toBe(true);
  });

  it("maps severity for high-signal topics", () => {
    const events = buildNotificationOperationalFeed({ whatsappStalePackets: 0 });
    const wa = events.find((e) => e.kind === NotificationOperationalEventKind.WHATSAPP_STALE);
    expect(wa?.severity).toBe("urgent");
  });

  it("counts urgent and critical feed rows", () => {
    const events = buildNotificationOperationalFeed({});
    const n = countHighSeverityNotificationFeed(events);
    expect(n).toBeGreaterThan(0);
  });
});

describe("buildMediaOperationalFeed", () => {
  it("uses deterministic ids and null occurredAt", () => {
    const events = buildMediaOperationalFeed({});
    expect(events.every((e) => e.occurredAt === null)).toBe(true);
    expect(events.some((e) => e.id === "media-vault:shell:metadata_only")).toBe(true);
    expect(events.some((e) => e.kind === MediaOperationalEventKind.LABEL_PREVIEW)).toBe(true);
  });

  it("counts manual verification placeholders in catalog", () => {
    const cat = buildMediaVaultProjectionCatalog();
    expect(countMediaManualVerificationProjections(cat)).toBe(1);
  });
});
