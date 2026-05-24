import type { WriteActionKind } from "./writeActionKinds";
import type { WriteActorRole } from "./writeAuthorityTypes";
import type { OperationalEntityRef } from "@/lib/operational-events/types";
import type { WriteFeatureFlagKey } from "@/config/writeFeatureFlags";

export interface WriteAuditEnvelopeInput {
  actionKind: WriteActionKind;
  actorRole: WriteActorRole;
  actorId?: string | null;
  entityRefs: OperationalEntityRef[];
  beforeSnapshot: unknown;
  afterSnapshotPreview: unknown;
  reason: string;
  /** ISO string from caller clock — not asserted as authoritative server time. */
  clientTimestampIso: string;
  idempotencyKey: string;
  correlationId: string;
  rollbackPlan: string;
  featureFlagSnapshot: Record<WriteFeatureFlagKey, boolean>;
}

export interface WriteAuditEnvelope extends WriteAuditEnvelopeInput {
  envelopeVersion: 1;
  /** Always false in this foundation — no adapter executed. */
  persisted: false;
}

export function buildWriteAuditEnvelope(input: WriteAuditEnvelopeInput): WriteAuditEnvelope {
  return {
    envelopeVersion: 1,
    persisted: false,
    ...input,
  };
}
