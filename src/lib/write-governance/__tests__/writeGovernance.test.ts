import { describe, expect, it } from "vitest";
import { WRITE_ACTION_KINDS } from "@/lib/write-governance/writeActionKinds";
import { WRITE_AUTHORITY } from "@/lib/write-governance/writeAuthorityMatrix";
import { WRITE_FEATURE_FLAGS } from "@/config/writeFeatureFlags";
import { buildWriteAuditEnvelope } from "@/lib/write-governance/writeAuditEnvelope";
import { deriveWriteIdempotencyKey } from "@/lib/write-governance/writeIdempotency";
import { rollbackPathForWriteAction } from "@/lib/write-governance/writeRollback";
import {
  validateApprovalRequestWrite,
  validateFactoryFollowupWrite,
  validateInventoryHoldRequest,
  validateInventoryReconciliationNoteWrite,
  validateMediaMetadataWrite,
  validateNotificationAcknowledgeWrite,
  validateReservationDraftWrite,
} from "@/lib/write-governance/writePreflight";
import { featureFlagSnapshot } from "@/lib/write-governance/writeFeatureGate";

const base = {
  actorId: "actor-1",
  correlationId: "corr-1",
};

describe("write preflight validators", () => {
  it("blocks reservation draft when required fields are missing", () => {
    const r = validateReservationDraftWrite({
      storeId: "",
      customerName: "x",
      phone: "x",
      product: "x",
      qtyDisplay: "x",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("storeId"))).toBe(true);
  });

  it("blocks factory follow-up when required fields are missing", () => {
    const r = validateFactoryFollowupWrite({
      storeId: "s1",
      product: "",
      qtyDisplay: "1",
      neededByDisplay: "soon",
      department: "d",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("product"))).toBe(true);
  });

  it("blocks media metadata when required fields are missing", () => {
    const r = validateMediaMetadataWrite({
      entityId: "",
      mediaKind: "pdf",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("entityId"))).toBe(true);
  });

  it("blocks notification acknowledge when required fields are missing", () => {
    const r = validateNotificationAcknowledgeWrite({
      notificationId: "",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("notificationId"))).toBe(true);
  });

  it("blocks inventory hold when required fields are missing", () => {
    const r = validateInventoryHoldRequest({
      skuOrRef: "",
      qtyIntentDisplay: "1",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("skuOrRef"))).toBe(true);
  });

  it("blocks reconciliation note when required fields are missing", () => {
    const r = validateInventoryReconciliationNoteWrite({
      skuOrRef: "sku",
      noteBody: "",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("noteBody"))).toBe(true);
  });

  it("blocks approval request when required fields are missing", () => {
    const r = validateApprovalRequestWrite({
      subject: "",
      route: "finance",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.some((b) => b.includes("subject"))).toBe(true);
  });

  it("includes feature-flag blockers while flags are false", () => {
    const r = validateReservationDraftWrite({
      storeId: "s",
      customerName: "c",
      phone: "p",
      product: "pr",
      qtyDisplay: "1",
      actorId: base.actorId,
      correlationId: base.correlationId,
    });
    expect(r.blockers.some((b) => b.toLowerCase().includes("feature flag"))).toBe(true);
  });
});

describe("write audit envelope", () => {
  it("includes required fields and persisted false", () => {
    const env = buildWriteAuditEnvelope({
      actionKind: "retail.reservation_draft.create",
      actorRole: "store_operator",
      actorId: "u1",
      entityRefs: [{ entityType: "store", id: "s1" }],
      beforeSnapshot: null,
      afterSnapshotPreview: { x: 1 },
      reason: "test",
      clientTimestampIso: "2026-05-20T12:00:00.000Z",
      idempotencyKey: "k",
      correlationId: "c",
      rollbackPlan: "retail_reservations:cancel_draft_row + audit append",
      featureFlagSnapshot: featureFlagSnapshot(),
    });
    expect(env.envelopeVersion).toBe(1);
    expect(env.persisted).toBe(false);
    expect(env.actionKind).toBe("retail.reservation_draft.create");
    expect(env.idempotencyKey).toBe("k");
    expect(env.correlationId).toBe("c");
    expect(env.rollbackPlan.length).toBeGreaterThan(0);
    expect(env.featureFlagSnapshot.ENABLE_RETAIL_RESERVATION_WRITES).toBe(false);
  });
});

describe("deriveWriteIdempotencyKey", () => {
  it("is deterministic for identical inputs", () => {
    const input = {
      kind: "approval.request.create" as const,
      scopeKey: "scope-a",
      actorId: "a1",
      correlationId: "c1",
    };
    expect(deriveWriteIdempotencyKey(input)).toBe(deriveWriteIdempotencyKey({ ...input }));
  });

  it("changes when correlation id changes", () => {
    const a = deriveWriteIdempotencyKey({
      kind: "notification.acknowledge",
      scopeKey: "n1",
      actorId: "a",
      correlationId: "c1",
    });
    const b = deriveWriteIdempotencyKey({
      kind: "notification.acknowledge",
      scopeKey: "n1",
      actorId: "a",
      correlationId: "c2",
    });
    expect(a).not.toBe(b);
  });
});

describe("WRITE_FEATURE_FLAGS", () => {
  it("keeps all flags false in this build", () => {
    for (const v of Object.values(WRITE_FEATURE_FLAGS)) {
      expect(v).toBe(false);
    }
  });
});

describe("rollbackPathForWriteAction", () => {
  it("returns a non-empty rollback path for every action kind", () => {
    for (const kind of WRITE_ACTION_KINDS) {
      const path = rollbackPathForWriteAction(kind);
      expect(path.length).toBeGreaterThan(0);
      expect(WRITE_AUTHORITY[kind].rollbackKind).toBeDefined();
    }
  });
});
