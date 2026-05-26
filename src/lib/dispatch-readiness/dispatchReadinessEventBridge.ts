import type {
  DispatchOperationalEventRecord,
  DispatchOperationalEventType,
  DispatchReadinessProjection,
  DispatchReadinessWriteContext,
} from "./dispatchReadinessTypes";

export function buildDispatchOperationalEvent(
  eventType: DispatchOperationalEventType,
  orderId: string,
  ctx: DispatchReadinessWriteContext,
  title: string,
  message: string,
): DispatchOperationalEventRecord {
  return {
    id: crypto.randomUUID(),
    eventType,
    orderId,
    entityType: "dispatch_readiness",
    entityId: orderId,
    title,
    message,
    actorId: ctx.actorUserId,
    actorRole: ctx.actorRole,
    correlationId: ctx.correlationId,
    visibility: "internal",
    occurredAt: new Date().toISOString(),
  };
}

export function eventTypeForReadinessReview(projection: DispatchReadinessProjection): DispatchOperationalEventType {
  if (projection.readinessStatus === "gate_eligible") {
    return "dispatch_gate_eligible";
  }
  return "dispatch_readiness_reviewed";
}

export function readinessReviewMessage(projection: DispatchReadinessProjection): string {
  return [
    `Status: ${projection.readinessStatus}`,
    `Gate: ${projection.gateEligibility}`,
    projection.blockingReasons.length
      ? `Blockers: ${projection.blockingReasons.join("; ")}`
      : "No blockers",
    "Not dispatched — eligibility only.",
  ].join(" · ");
}
