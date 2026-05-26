import type {
  StockFinalizationOperationalEventRecord,
  StockFinalizationOperationalEventType,
  StockFinalizationWriteContext,
} from "./stockFinalizationTypes";

export function buildStockFinalizationEvent(
  eventType: StockFinalizationOperationalEventType,
  orderId: string,
  title: string,
  message: string,
  ctx: StockFinalizationWriteContext,
  metadata?: Record<string, unknown>,
): Omit<StockFinalizationOperationalEventRecord, "id" | "occurredAt"> {
  return {
    eventType,
    orderId,
    title,
    message,
    actorId: ctx.actorUserId,
    actorRole: ctx.actorRole,
    correlationId: ctx.correlationId,
    visibility: "internal",
    metadata: {
      ...metadata,
      customerSafe: false,
      customerTimelinePublish: false,
    },
  };
}

export function suppressStockEventFromCustomer(_message: string, eventType: string): boolean {
  const internalOnly: StockFinalizationOperationalEventType[] = [
    "stock_consumption_finalized",
    "stock_consumption_reversed",
    "stock_variance_detected",
    "stock_variance_recorded",
    "stock_quarantined",
    "stock_quarantine_released",
  ];
  return (internalOnly as string[]).includes(eventType);
}
