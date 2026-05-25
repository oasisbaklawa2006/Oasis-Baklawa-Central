import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryOperationalExecutionBundle } from "../operationalExecutionBundle";
const ACTOR = {
  correlationId: "corr-3b",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "OPERATIONS_MANAGER",
};

describe("operationalExecutionService", () => {
  const bundle = createInMemoryOperationalExecutionBundle();

  beforeEach(() => bundle.reset());

  async function seedPending() {
    const { item } = await bundle.repository.createQueueItem(
      {
        queueType: "production_queue",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000101",
        title: "3B seed",
        priorityBand: "routine",
      },
      ACTOR,
    );
    return item;
  }

  it("exposes all charter actions with operational_events", async () => {
    const created = await seedPending();
    const ack = await bundle.execution.acknowledgeQueueItem(
      { queueItemId: created.id, expectedVersion: created.version },
      ACTOR,
    );
    expect(ack.item.state).toBe("acknowledged");
    const assigned = await bundle.execution.assignQueueItem(
      {
        queueItemId: ack.item.id,
        expectedVersion: ack.item.version,
        toUserId: "00000000-0000-4000-8000-000000000010",
        reason: "Owner",
      },
      ACTOR,
    );
    const started = await bundle.execution.startQueueItem(
      { queueItemId: assigned.item.id, expectedVersion: assigned.item.version },
      ACTOR,
    );
    const blocked = await bundle.execution.blockQueueItem(
      {
        queueItemId: started.item.id,
        expectedVersion: started.item.version,
        reason: "Waiting on material",
        blockerCode: "material",
      },
      ACTOR,
    );
    expect(blocked.item.state).toBe("blocked");
    const unblocked = await bundle.repository.transitionQueueItem(
      {
        queueItemId: blocked.item.id,
        expectedVersion: blocked.item.version,
        action: "unblock",
      },
      ACTOR,
    );
    expect(unblocked.item.state).toBe("in_progress");
    const escalated = await bundle.execution.escalateQueueItem(
      {
        queueItemId: unblocked.item.id,
        expectedVersion: unblocked.item.version,
        reason: "SLA risk",
      },
      ACTOR,
    );
    expect(escalated.item.state).toBe("escalated");
    const deEsc = await bundle.repository.transitionQueueItem(
      {
        queueItemId: escalated.item.id,
        expectedVersion: escalated.item.version,
        action: "de_escalate",
      },
      ACTOR,
    );
    const done = await bundle.execution.completeQueueItem(
      { queueItemId: deEsc.item.id, expectedVersion: deEsc.item.version },
      ACTOR,
    );
    expect(done.item.state).toBe("completed");
    const events = await bundle.events.listByQueueItem(created.id);
    const types = events.map((e) => e.eventType);
    expect(types).toContain("queue_acknowledged");
    expect(types).toContain("queue_blocked");
    expect(types).toContain("queue_escalated");
    expect(types).toContain("queue_completed");
  });

  it("fail and cancel require typed reason at service layer", async () => {
    const item = await seedPending();
    const ack = await bundle.execution.acknowledgeQueueItem(
      { queueItemId: item.id, expectedVersion: item.version },
      ACTOR,
    );
    const assigned = await bundle.execution.assignQueueItem(
      {
        queueItemId: ack.item.id,
        expectedVersion: ack.item.version,
        toUserId: "00000000-0000-4000-8000-000000000010",
      },
      ACTOR,
    );
    const started = await bundle.execution.startQueueItem(
      { queueItemId: assigned.item.id, expectedVersion: assigned.item.version },
      ACTOR,
    );
    await expect(
      bundle.execution.failQueueItem(
        { queueItemId: started.item.id, expectedVersion: started.item.version, reason: "  " },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: "reason_required" });
    const failed = await bundle.execution.failQueueItem(
      {
        queueItemId: started.item.id,
        expectedVersion: started.item.version,
        reason: "Quality hold",
      },
      ACTOR,
    );
    expect(failed.item.state).toBe("failed");

    const item2 = await seedPending();
    await expect(
      bundle.execution.cancelQueueItem(
        { queueItemId: item2.id, expectedVersion: item2.version, reason: "" },
        { ...ACTOR, actorRole: "SUPER_ADMIN" },
      ),
    ).rejects.toMatchObject({ code: "reason_required" });
  });

  it("maps stale version to OperationalExecutionError", async () => {
    const item = await seedPending();
    await expect(
      bundle.execution.acknowledgeQueueItem(
        { queueItemId: item.id, expectedVersion: 999 },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: "stale_version" });
  });

  it("maps illegal transition to OperationalExecutionError", async () => {
    const item = await seedPending();
    await expect(
      bundle.execution.startQueueItem(
        { queueItemId: item.id, expectedVersion: item.version },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: "illegal_transition" });
  });

  it("denies scoped role without queue access", async () => {
    const item = await seedPending();
    await expect(
      bundle.execution.acknowledgeQueueItem(
        { queueItemId: item.id, expectedVersion: item.version },
        { ...ACTOR, actorRole: "SUPPORT_EXECUTIVE" },
      ),
    ).rejects.toMatchObject({ code: "authority_denied" });
  });

  it("addOperationalNote appends operational_note_added", async () => {
    const item = await seedPending();
    const { eventId } = await bundle.execution.addOperationalNote(
      { queueItemId: item.id, note: "Checked with production lead" },
      ACTOR,
    );
    expect(eventId).toBeTruthy();
    const events = await bundle.events.listByQueueItem(item.id);
    expect(events.some((e) => e.eventType === "operational_note_added")).toBe(true);
  });

  it("listOpenQueueItems returns only non-terminal open states", async () => {
    const a = await seedPending();
    const b = await seedPending();
    const done = await bundle.execution.acknowledgeQueueItem(
      { queueItemId: b.id, expectedVersion: b.version },
      ACTOR,
    );
    const assigned = await bundle.execution.assignQueueItem(
      {
        queueItemId: done.item.id,
        expectedVersion: done.item.version,
        toUserId: "00000000-0000-4000-8000-000000000010",
      },
      ACTOR,
    );
    const started = await bundle.execution.startQueueItem(
      { queueItemId: assigned.item.id, expectedVersion: assigned.item.version },
      ACTOR,
    );
    await bundle.execution.completeQueueItem(
      { queueItemId: started.item.id, expectedVersion: started.item.version },
      ACTOR,
    );
    const open = await bundle.read.listOpenQueueItems();
    expect(open.some((i) => i.id === a.id)).toBe(true);
    expect(open.some((i) => i.id === started.item.id)).toBe(false);
  });
});
