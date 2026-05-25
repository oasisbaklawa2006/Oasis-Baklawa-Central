import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryOperationalExecutionBundle } from "../operationalExecutionBundle";

const ACTOR = {
  correlationId: "corr-note",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "OPERATIONS_MANAGER",
};

describe("operational note metadata", () => {
  const bundle = createInMemoryOperationalExecutionBundle();
  beforeEach(() => bundle.reset());

  it("merges photo metadata into operational event", async () => {
    const { item } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000101",
        title: "Note meta",
        priorityBand: "routine",
      },
      ACTOR,
    );
    await bundle.execution.addOperationalNote(
      {
        queueItemId: item.id,
        note: "Photo attached",
        metadata: { operationalPhoto: { imageReference: "internal://x" } },
      },
      ACTOR,
    );
    const events = await bundle.events.listByQueueItem(item.id);
    expect(events[events.length - 1]?.metadata.operationalPhoto).toBeTruthy();
  });
});
