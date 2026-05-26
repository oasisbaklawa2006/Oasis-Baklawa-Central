import type {
  FinanceGovernanceWriteContext,
  FinanceOperationalEventRecord,
  FinanceOperationalEventType,
  FinanceReleaseProjection,
} from "./financeGovernanceTypes";

export function buildFinanceOperationalEvent(
  eventType: FinanceOperationalEventType,
  orderId: string,
  ctx: FinanceGovernanceWriteContext,
  title: string,
  message: string,
): FinanceOperationalEventRecord {
  return {
    id: crypto.randomUUID(),
    eventType,
    orderId,
    title,
    message,
    actorId: ctx.actorUserId,
    actorRole: ctx.actorRole,
    correlationId: ctx.correlationId,
    visibility: "internal",
    occurredAt: new Date().toISOString(),
  };
}

export function commercialReleaseEventMessage(projection: FinanceReleaseProjection): string {
  return [
    `Status: ${projection.releaseStatus}`,
    `Risk: ${projection.commercialRiskLevel}`,
    `Dispatch signal: ${projection.dispatchFinanceSignal}`,
    "Not invoiced · not dispatched · no payment capture",
  ].join(" · ");
}
