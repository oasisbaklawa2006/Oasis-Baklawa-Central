import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryPersistentQueueBundle } from "../supabasePersistentQueueRepository";

const ACTOR = {
  correlationId: "corr-test",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "OPERATIONS_MANAGER",
};

describe("persistentQueueRepository", () => {
  const bundle = createInMemoryPersistentQueueBundle();

  beforeEach(() => bundle.reset());

  it("createQueueItem emits queue_created event", async () => {
    const { item, eventId } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000001",
        title: "Production follow-up",
        priorityBand: "urgent",
      },
      ACTOR,
    );
    expect(item.state).toBe("pending");
    expect(eventId).toBeTruthy();
    const events = await bundle.events.listByQueueItem(item.id);
    expect(events[0]?.eventType).toBe("queue_created");
  });

  it("runs pending → acknowledged → assigned → in_progress → completed", async () => {
    const { item: created } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000002",
        title: "Lifecycle path",
        priorityBand: "routine",
      },
      ACTOR,
    );
    const ack = await bundle.repository.transitionQueueItem(
      { queueItemId: created.id, expectedVersion: created.version, action: "acknowledge" },
      ACTOR,
    );
    expect(ack.item.state).toBe("acknowledged");
    const assigned = await bundle.repository.assignQueueItem(
      {
        queueItemId: ack.item.id,
        expectedVersion: ack.item.version,
        toUserId: "00000000-0000-4000-8000-000000000010",
        reason: "Owner",
      },
      ACTOR,
    );
    expect(assigned.item.state).toBe("assigned");
    const started = await bundle.repository.transitionQueueItem(
      { queueItemId: assigned.item.id, expectedVersion: assigned.item.version, action: "start" },
      ACTOR,
    );
    expect(started.item.state).toBe("in_progress");
    const done = await bundle.repository.transitionQueueItem(
      { queueItemId: started.item.id, expectedVersion: started.item.version, action: "complete" },
      ACTOR,
    );
    expect(done.item.state).toBe("completed");
    expect(done.item.completedAt).toBeTruthy();
  });

  it("denies invalid backward transition", async () => {
    const { item } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000003",
        title: "Invalid",
        priorityBand: "routine",
      },
      ACTOR,
    );
    const completed = await bundle.repository.transitionQueueItem(
      {
        queueItemId: item.id,
        expectedVersion: item.version,
        action: "acknowledge",
      },
      ACTOR,
    );
    const assigned = await bundle.repository.assignQueueItem(
      {
        queueItemId: completed.item.id,
        expectedVersion: completed.item.version,
        toUserId: "00000000-0000-4000-8000-000000000010",
      },
      ACTOR,
    );
    const started = await bundle.repository.transitionQueueItem(
      { queueItemId: assigned.item.id, expectedVersion: assigned.item.version, action: "start" },
      ACTOR,
    );
    const done = await bundle.repository.transitionQueueItem(
      { queueItemId: started.item.id, expectedVersion: started.item.version, action: "complete" },
      ACTOR,
    );
    await expect(
      bundle.repository.transitionQueueItem(
        { queueItemId: done.item.id, expectedVersion: done.item.version, action: "start" },
        ACTOR,
      ),
    ).rejects.toThrow(/Cannot start/);
  });

  it("rejects stale version", async () => {
    const { item } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000004",
        title: "Version",
        priorityBand: "routine",
      },
      ACTOR,
    );
    await expect(
      bundle.repository.transitionQueueItem(
        { queueItemId: item.id, expectedVersion: 99, action: "acknowledge" },
        ACTOR,
      ),
    ).rejects.toThrow(/Stale queue version/);
  });

  it("dedupes create via idempotency_key", async () => {
    const correlation = { ...ACTOR, idempotencyKey: "create-once" };
    const a = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000005",
        title: "Idempotent",
        priorityBand: "routine",
      },
      correlation,
    );
    const b = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000005",
        title: "Idempotent",
        priorityBand: "routine",
      },
      correlation,
    );
    expect(a.item.id).toBe(b.item.id);
  });

  it("cancel requires non-empty reason", async () => {
    const { item } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000007",
        title: "Cancel reason",
        priorityBand: "routine",
      },
      { ...ACTOR, actorRole: "SUPER_ADMIN" },
    );
    await expect(
      bundle.repository.cancelQueueItem(item.id, item.version, "  ", {
        ...ACTOR,
        actorRole: "SUPER_ADMIN",
      }),
    ).rejects.toThrow(/non-empty reason/i);
  });

  it("cancel requires super admin when ADMIN", async () => {
    const { item } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000006",
        title: "Cancel auth",
        priorityBand: "routine",
      },
      ACTOR,
    );
    await expect(
      bundle.repository.cancelQueueItem(item.id, item.version, "no", {
        ...ACTOR,
        actorRole: "ADMIN",
      }),
    ).rejects.toThrow(/cannot cancel/i);
  });
});
