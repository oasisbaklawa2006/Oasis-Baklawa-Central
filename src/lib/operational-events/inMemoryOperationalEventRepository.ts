import { assertAppendOnlyMutation } from "./operationalEventImmutability";
import { assertSafeEventMetadata, normalizeEventVisibility } from "./eventVisibility";
import type { AppendOperationalEventInput, OperationalStoreEventRecord } from "./operationalEventTypes";
import type { OperationalEventRepository } from "./operationalEventRepository";

export function createInMemoryOperationalEventRepository(): OperationalEventRepository & {
  _reset: () => void;
} {
  const events: OperationalStoreEventRecord[] = [];
  const byIdempotency = new Map<string, OperationalStoreEventRecord>();

  return {
    async appendEvent(input: AppendOperationalEventInput): Promise<OperationalStoreEventRecord> {
      assertAppendOnlyMutation("insert");
      if (input.idempotencyKey) {
        const existing = byIdempotency.get(input.idempotencyKey);
        if (existing) return existing;
      }
      if (!input.correlationId?.trim()) {
        throw new Error("operational event requires correlation_id");
      }
      const record: OperationalStoreEventRecord = {
        id: crypto.randomUUID(),
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        orderId: input.orderId ?? null,
        customerId: input.customerId ?? null,
        queueItemId: input.queueItemId ?? null,
        actorId: input.actorId,
        actorRole: input.actorRole,
        actorDepartment: input.actorDepartment ?? null,
        visibility: normalizeEventVisibility(input.visibility),
        severity: input.severity ?? "info",
        title: input.title,
        message: input.message ?? null,
        reasonCode: input.reasonCode ?? null,
        reasonText: input.reasonText ?? null,
        metadata: assertSafeEventMetadata(input.metadata ?? {}),
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt: new Date().toISOString(),
      };
      events.push(record);
      if (record.idempotencyKey) byIdempotency.set(record.idempotencyKey, record);
      return record;
    },

    async findByIdempotencyKey(key: string) {
      return byIdempotency.get(key) ?? null;
    },

    async listByEntity(entityType: string, entityId: string, limit = 50) {
      return events
        .filter((e) => e.entityType === entityType && e.entityId === entityId)
        .slice(-limit);
    },

    async listByQueueItem(queueItemId: string, limit = 50) {
      return events.filter((e) => e.queueItemId === queueItemId).slice(-limit);
    },

    _reset() {
      events.length = 0;
      byIdempotency.clear();
    },
  };
}
