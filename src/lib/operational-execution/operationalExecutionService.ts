import type { PersistentQueueWriteService } from "@/lib/persistent-queues/persistentQueueRepository";
import {
  mapRepositoryError,
  requireExecutionReason,
} from "./operationalExecutionErrors";
import type {
  AssignQueueExecutionInput,
  BlockQueueExecutionInput,
  OperationalExecutionContext,
  OperationalNoteInput,
  OperationalNoteResult,
  QueueExecutionActionInput,
  QueueExecutionActionResult,
  ReasonedQueueExecutionInput,
} from "./operationalExecutionTypes";
import { toQueueWriteCorrelation } from "./operationalExecutionTypes";

async function runAction<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    mapRepositoryError(err);
  }
}

function correlationFor(
  ctx: OperationalExecutionContext,
  action: string,
  queueItemId: string,
  expectedVersion: number,
) {
  return toQueueWriteCorrelation(ctx, `${action}:${queueItemId}:${expectedVersion}`);
}

/**
 * Authority-gated operational queue actions. All writes go through the persistent
 * queue repository (lifecycle validation + operational_events append).
 */
export function createOperationalExecutionService(repository: PersistentQueueWriteService) {
  return {
    async acknowledgeQueueItem(
      input: QueueExecutionActionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      return runAction(() =>
        repository.transitionQueueItem(
          {
            queueItemId: input.queueItemId,
            expectedVersion: input.expectedVersion,
            action: "acknowledge",
          },
          correlationFor(ctx, "acknowledge", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async assignQueueItem(
      input: AssignQueueExecutionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      return runAction(() =>
        repository.assignQueueItem(
          {
            queueItemId: input.queueItemId,
            expectedVersion: input.expectedVersion,
            toUserId: input.toUserId,
            toDepartment: input.toDepartment,
            reason: input.reason,
          },
          correlationFor(ctx, "assign", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async startQueueItem(
      input: QueueExecutionActionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      return runAction(() =>
        repository.transitionQueueItem(
          {
            queueItemId: input.queueItemId,
            expectedVersion: input.expectedVersion,
            action: "start",
          },
          correlationFor(ctx, "start", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async blockQueueItem(
      input: BlockQueueExecutionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      requireExecutionReason(input.reason, "queue:block");
      return runAction(() =>
        repository.transitionQueueItem(
          {
            queueItemId: input.queueItemId,
            expectedVersion: input.expectedVersion,
            action: "block",
            reasonText: input.reason,
            blockerCode: input.blockerCode,
            blockerSummary: input.blockerSummary ?? input.reason,
          },
          correlationFor(ctx, "block", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async escalateQueueItem(
      input: ReasonedQueueExecutionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      requireExecutionReason(input.reason, "queue:escalate");
      return runAction(() =>
        repository.escalateQueueItem(
          input.queueItemId,
          input.expectedVersion,
          input.reason,
          correlationFor(ctx, "escalate", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async completeQueueItem(
      input: QueueExecutionActionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      return runAction(() =>
        repository.transitionQueueItem(
          {
            queueItemId: input.queueItemId,
            expectedVersion: input.expectedVersion,
            action: "complete",
          },
          correlationFor(ctx, "complete", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async failQueueItem(
      input: ReasonedQueueExecutionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      requireExecutionReason(input.reason, "queue:fail");
      return runAction(() =>
        repository.failQueueItem(
          input.queueItemId,
          input.expectedVersion,
          input.reason,
          correlationFor(ctx, "fail", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async cancelQueueItem(
      input: ReasonedQueueExecutionInput,
      ctx: OperationalExecutionContext,
    ): Promise<QueueExecutionActionResult> {
      requireExecutionReason(input.reason, "queue:cancel");
      return runAction(() =>
        repository.cancelQueueItem(
          input.queueItemId,
          input.expectedVersion,
          input.reason,
          correlationFor(ctx, "cancel", input.queueItemId, input.expectedVersion),
        ),
      );
    },

    async addOperationalNote(
      input: OperationalNoteInput,
      ctx: OperationalExecutionContext,
    ): Promise<OperationalNoteResult> {
      requireExecutionReason(input.note, "queue:note");
      return runAction(() =>
        repository.addOperationalNote(
          input.queueItemId,
          input.note,
          correlationFor(ctx, "note", input.queueItemId, 0),
          input.metadata,
        ),
      );
    },
  };
}

export type OperationalExecutionService = ReturnType<typeof createOperationalExecutionService>;
