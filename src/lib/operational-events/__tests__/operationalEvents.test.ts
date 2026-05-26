import { describe, expect, it } from "vitest";
import { createInMemoryOperationalEventRepository } from "../inMemoryOperationalEventRepository";
import { assertAppendOnlyMutation, rejectEventUpdateDelete } from "../operationalEventImmutability";
import { isCustomerPublishedVisibility } from "../eventVisibility";
import { assertSafeEventMetadata } from "../eventVisibility";

describe("operational event store", () => {
  it("requires correlation_id", async () => {
    const repo = createInMemoryOperationalEventRepository();
    await expect(
      repo.appendEvent({
        eventType: "queue_created",
        entityType: "order",
        entityId: "00000000-0000-4000-8000-000000000001",
        actorId: "u1",
        actorRole: "OPERATIONS_MANAGER",
        title: "Queue created",
        correlationId: "",
      }),
    ).rejects.toThrow(/correlation_id/i);
  });

  it("defaults internal visibility", async () => {
    const repo = createInMemoryOperationalEventRepository();
    const ev = await repo.appendEvent({
      eventType: "queue_created",
      entityType: "order",
      entityId: "00000000-0000-4000-8000-000000000001",
      actorId: "u1",
      actorRole: "OPERATIONS_MANAGER",
      title: "Queue created",
      correlationId: "corr-1",
    });
    expect(ev.visibility).toBe("internal");
  });

  it("public_candidate is not customer published", () => {
    expect(isCustomerPublishedVisibility("public_candidate")).toBe(false);
  });

  it("append-only helper rejects update/delete", () => {
    expect(() => assertAppendOnlyMutation("update")).toThrow(/append-only/i);
    expect(() => rejectEventUpdateDelete()).toThrow(/append-only/i);
  });

  it("dedupes by idempotency_key", async () => {
    const repo = createInMemoryOperationalEventRepository();
    const input = {
      eventType: "queue_assigned" as const,
      entityType: "order",
      entityId: "00000000-0000-4000-8000-000000000002",
      actorId: "u1",
      actorRole: "OPERATIONS_MANAGER",
      title: "Assigned",
      correlationId: "corr-2",
      idempotencyKey: "idem-1",
    };
    const a = await repo.appendEvent(input);
    const b = await repo.appendEvent(input);
    expect(a.id).toBe(b.id);
  });

  it("sanitizes unsafe metadata keys", () => {
    const meta = assertSafeEventMetadata({ note: "ok", password: "x", fn: () => 1 });
    expect(meta).toEqual({ note: "ok" });
  });
});
