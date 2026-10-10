import { classifyIntegrationError } from "@/lib/integration-contracts";
import type { QueueFailureRecord, PersistentQueueItemId } from "./persistentQueueTypes";

export function buildQueueFailureRecord(input: {
  queueItemId: PersistentQueueItemId;
  code: string;
  message: string;
  err?: unknown;
  actorUserId: string;
  failedAt?: string;
}): QueueFailureRecord {
  const classified = classifyIntegrationError({
    err: input.err ?? new Error(input.message),
    source: "persistent-queue",
    operation: "write",
  });
  return {
    queueItemId: input.queueItemId,
    code: input.code || classified.code,
    message: input.message,
    retryable: classified.retryable,
    failedAt: input.failedAt ?? new Date().toISOString(),
    actorUserId: input.actorUserId,
  };
}
