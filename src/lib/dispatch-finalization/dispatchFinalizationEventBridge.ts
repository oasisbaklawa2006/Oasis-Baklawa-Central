import type {
  DispatchFinalizationOperationalEventRecord,
  DispatchFinalizationOperationalEventType,
  DispatchFinalizationWriteContext,
} from "./dispatchFinalizationTypes";

export function buildFinalizationOperationalEvent(
  eventType: DispatchFinalizationOperationalEventType,
  orderId: string,
  ctx: DispatchFinalizationWriteContext,
  title: string,
  message: string,
  visibility: "internal" | "customer_safe" = "internal",
): DispatchFinalizationOperationalEventRecord {
  return {
    id: `dfe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    eventType,
    orderId,
    title,
    message,
    actorId: ctx.actorUserId,
    actorRole: ctx.actorRole,
    correlationId: ctx.correlationId,
    visibility,
    occurredAt: new Date().toISOString(),
  };
}
