import { describe, expect, it } from "vitest";
import { buildWriteIntentOperationalFeed } from "@/lib/operational-events/writeIntentFeed";
import { WriteIntentOperationalEventKind } from "@/lib/operational-events/types";
import { validateReservationDraftWrite } from "@/lib/write-governance/writePreflight";

describe("buildWriteIntentOperationalFeed", () => {
  it("emits intent previewed and flag disabled while writes are off", () => {
    const preflight = validateReservationDraftWrite({
      storeId: "s",
      customerName: "c",
      phone: "p",
      product: "x",
      qtyDisplay: "1",
      actorId: "a",
      correlationId: "corr-x",
    });
    const events = buildWriteIntentOperationalFeed({
      actionKind: "retail.reservation_draft.create",
      preflight,
      auditEnvelopePreview: "{}",
      idempotencyKeyPreview: "key",
      correlationId: "corr-x",
    });
    expect(events.some((e) => e.kind === WriteIntentOperationalEventKind.INTENT_PREVIEWED)).toBe(true);
    expect(events.some((e) => e.kind === WriteIntentOperationalEventKind.FEATURE_FLAG_DISABLED)).toBe(true);
    expect(events.some((e) => e.kind === WriteIntentOperationalEventKind.PREFLIGHT_BLOCKED)).toBe(true);
    expect(events.some((e) => e.kind === WriteIntentOperationalEventKind.AUDIT_ENVELOPE_READY)).toBe(false);
    expect(events.every((e) => e.occurredAt === null)).toBe(true);
  });
});
