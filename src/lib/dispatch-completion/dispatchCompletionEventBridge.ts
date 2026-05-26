import type {
  DispatchCompletionOperationalEventRecord,
  DispatchCompletionOperationalEventType,
  DispatchCompletionProjection,
  DispatchCompletionWriteContext,
} from "./dispatchCompletionTypes";

export function buildDispatchCompletionOperationalEvent(
  eventType: DispatchCompletionOperationalEventType,
  orderId: string,
  ctx: DispatchCompletionWriteContext,
  title: string,
  message: string,
): DispatchCompletionOperationalEventRecord {
  return {
    id: `dce-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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

export function completionReviewMessage(projection: DispatchCompletionProjection): string {
  return `${projection.completionStatus}: ${projection.completionRecommendation}`;
}
