import { dedupeOperationalEventsById } from "./normalize";
import type { OperationalEventRecord } from "./types";
import { WriteIntentOperationalEventKind } from "./types";
import type { WritePreflightResult } from "@/lib/write-governance/writePreflight";
import type { WriteActionKind } from "@/lib/write-governance/writeActionKinds";
import { isWriteFeatureEnabled } from "@/lib/write-governance/writeFeatureGate";

const SOURCE = "derived_write_intent" as const;

export interface WriteIntentFeedInput {
  actionKind: WriteActionKind;
  preflight: WritePreflightResult;
  /** JSON string or short summary for timeline display. */
  auditEnvelopePreview: string;
  idempotencyKeyPreview: string;
  correlationId: string;
}

export function buildWriteIntentOperationalFeed(input: WriteIntentFeedInput): OperationalEventRecord[] {
  let sortKey = 9600;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "operator", displayLabel: "Write intent preview" };
  const out: OperationalEventRecord[] = [];

  out.push({
    id: `write:intent:${input.actionKind}:${input.correlationId}`,
    kind: WriteIntentOperationalEventKind.INTENT_PREVIEWED,
    category: "audit",
    severity: "info",
    title: `Write intent preview · ${input.actionKind}`,
    detail: `Correlation · ${input.correlationId}\nPreflight allowed · ${input.preflight.allowed}\nBlockers · ${input.preflight.blockers.join(" | ") || "none"}`,
    occurredAt: null,
    sortKey: next(),
    actor,
    entities: [{ entityType: "ticket", id: input.correlationId }],
    source: SOURCE,
  });

  if (!isWriteFeatureEnabled(input.actionKind)) {
    out.push({
      id: `write:flag:${input.actionKind}`,
      kind: WriteIntentOperationalEventKind.FEATURE_FLAG_DISABLED,
      category: "audit",
      severity: "warning",
      title: "Write feature flag disabled",
      detail: "Persistence adapters must not run while flags are false.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  }

  if (!input.preflight.allowed) {
    out.push({
      id: `write:blocked:${input.actionKind}`,
      kind: WriteIntentOperationalEventKind.PREFLIGHT_BLOCKED,
      category: "escalation",
      severity: "warning",
      title: "Preflight blocked write",
      detail: input.preflight.blockers.join("\n"),
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  } else {
    out.push({
      id: `write:audit:${input.actionKind}`,
      kind: WriteIntentOperationalEventKind.AUDIT_ENVELOPE_READY,
      category: "audit",
      severity: "info",
      title: "Audit envelope ready (not persisted)",
      detail: `Idempotency key · ${input.idempotencyKeyPreview}\nEnvelope preview · ${input.auditEnvelopePreview}`,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  }

  return dedupeOperationalEventsById(out);
}
