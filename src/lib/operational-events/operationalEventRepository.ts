import type { AppendOperationalEventInput, OperationalStoreEventRecord } from "./operationalEventTypes";

export interface OperationalEventRepository {
  appendEvent(input: AppendOperationalEventInput): Promise<OperationalStoreEventRecord>;
  findByIdempotencyKey(key: string): Promise<OperationalStoreEventRecord | null>;
  listByEntity(entityType: string, entityId: string, limit?: number): Promise<OperationalStoreEventRecord[]>;
  listByQueueItem(queueItemId: string, limit?: number): Promise<OperationalStoreEventRecord[]>;
}
