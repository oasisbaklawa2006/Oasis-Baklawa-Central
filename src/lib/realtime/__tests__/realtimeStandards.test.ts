import { describe, expect, it, vi } from "vitest";
import {
  buildCentralRealtimeChannelName,
  normalizeRealtimeChannelName,
  supabaseTopicForChannel,
} from "../realtimeChannelNaming";
import {
  createRealtimeDedupeState,
  evaluateRealtimeDelta,
  recordAcceptedRealtimeDelta,
} from "../realtimeDedupe";
import {
  assertAuthorizedRealtimeChannel,
  validateRealtimeScope,
} from "../realtimeScopeGuard";
import {
  createRealtimeSubscriptionController,
  toRealtimeDeltaPayload,
  type RealtimeChannelAdapter,
} from "../realtimeSubscriptionController";
import {
  canApplyRealtimeDelta,
  isRealtimeTransportDegraded,
  shouldRunPollingFallback,
} from "../realtimeTransportState";
import { POINT23_FOREIGN_REPO_PREREQUISITES } from "../foreignRepoPrerequisites";
import { CENTRAL_REALTIME_CENSUS } from "../census";

describe("Point23 realtime scope guard", () => {
  it("fail closed on unresolved company scope", () => {
    const result = assertAuthorizedRealtimeChannel("orders", { type: "company" });
    expect(result.allowed).toBe(false);
    if (result.allowed !== true) {
      expect(result.reason).toMatch(/company_id/i);
    }
  });

  it("fail closed on unresolved user scope for notifications", () => {
    const result = assertAuthorizedRealtimeChannel("notifications", { type: "user" });
    expect(result.allowed).toBe(false);
  });

  it("allows global_staff war-room orders channel", () => {
    const result = assertAuthorizedRealtimeChannel("orders", { type: "global_staff" });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.channelName).toBe("central:orders:global_staff:staff");
    }
  });

  it("forbids global_staff on tenant-sensitive notifications domain", () => {
    const result = assertAuthorizedRealtimeChannel("notifications", { type: "global_staff" });
    expect(result.allowed).toBe(false);
    if (result.allowed !== true) {
      expect(result.reason).toMatch(/fail closed/i);
    }
  });

  it("requires tableName for postgres_table domain", () => {
    const result = assertAuthorizedRealtimeChannel("postgres_table", { type: "global_staff" });
    expect(result.allowed).toBe(false);
  });

  it("allows scoped user notifications channel", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const result = assertAuthorizedRealtimeChannel("notifications", {
      type: "user",
      userId,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.channelName).toBe(`central:notifications:user:${userId}`);
    }
  });
});

describe("Point23 channel naming", () => {
  it("normalizes double realtime: prefix for dedup", () => {
    expect(normalizeRealtimeChannelName("realtime:realtime:notif-count-abc")).toBe(
      "notif-count-abc",
    );
    expect(supabaseTopicForChannel("realtime:foo")).toBe("realtime:foo");
  });

  it("builds deterministic central channel names", () => {
    const companyId = "22222222-2222-4222-8222-222222222222";
    expect(
      buildCentralRealtimeChannelName("orders", { type: "company", companyId }),
    ).toBe(`central:orders:company:${companyId}`);
  });
});

describe("Point23 dedupe and stale version denial", () => {
  it("rejects duplicate event ids", () => {
    const state = createRealtimeDedupeState();
    const payload = {
      eventId: "evt-1",
      version: 100,
      table: "orders",
      entityId: "o1",
    };
    expect(evaluateRealtimeDelta(state, payload).accept).toBe(true);
    recordAcceptedRealtimeDelta(state, payload);
    expect(evaluateRealtimeDelta(state, payload).accept).toBe(false);
    expect(evaluateRealtimeDelta(state, payload).reason).toBe("duplicate_event");
  });

  it("rejects stale versions for the same entity", () => {
    const state = createRealtimeDedupeState();
    recordAcceptedRealtimeDelta(state, {
      eventId: "evt-2",
      version: 200,
      table: "orders",
      entityId: "o1",
    });
    const stale = evaluateRealtimeDelta(state, {
      eventId: "evt-3",
      version: 150,
      table: "orders",
      entityId: "o1",
    });
    expect(stale.accept).toBe(false);
    expect(stale.reason).toBe("stale_version");
  });
});

describe("Point23 transport state", () => {
  it("exposes degraded and polling fallback", () => {
    expect(isRealtimeTransportDegraded("degraded")).toBe(true);
    expect(isRealtimeTransportDegraded("subscribed")).toBe(false);
    expect(shouldRunPollingFallback("unavailable", 30_000)).toBe(true);
    expect(shouldRunPollingFallback("subscribed", 30_000)).toBe(false);
  });

  it("blocks delta before subscribed", () => {
    expect(canApplyRealtimeDelta("snapshot_loading")).toBe(false);
    expect(canApplyRealtimeDelta("subscribed")).toBe(true);
  });
});

describe("Point23 subscription controller", () => {
  const makeAdapter = (
    statuses: Array<"SUBSCRIBED" | "CHANNEL_ERROR" | "CLOSED">,
  ): RealtimeChannelAdapter => {
    let call = 0;
    return {
      subscribe: (_name, onStatus) => {
        const status = statuses[Math.min(call, statuses.length - 1)];
        call += 1;
        onStatus(status);
        return { unsubscribe: vi.fn() };
      },
    };
  };

  it("runs snapshot before accepting deltas", async () => {
    const order: string[] = [];
    const controller = createRealtimeSubscriptionController({
      domain: "orders",
      scope: { type: "global_staff" },
      changes: [{ event: "*", schema: "public", table: "orders" }],
      mode: "refetch",
      snapshot: async () => {
        order.push("snapshot");
      },
      onDelta: () => order.push("delta"),
      channelAdapter: makeAdapter(["SUBSCRIBED"]),
    });

    await controller.start();
    expect(order).toEqual(["snapshot"]);

    controller.handleDelta({
      eventId: "e1",
      version: 1,
      table: "orders",
      entityId: "o1",
    });
    expect(order).toEqual(["snapshot", "delta"]);
  });

  it("ignores deltas before snapshot completes", async () => {
    let deltas = 0;
    const controller = createRealtimeSubscriptionController({
      domain: "orders",
      scope: { type: "global_staff" },
      changes: [{ event: "*", schema: "public", table: "orders" }],
      mode: "refetch",
      snapshot: async () => {
        /* slow snapshot simulated by not calling start fully */
      },
      onDelta: () => {
        deltas += 1;
      },
      channelAdapter: makeAdapter(["SUBSCRIBED"]),
    });

    controller.handleDelta({
      eventId: "early",
      version: 1,
      table: "orders",
    });
    expect(deltas).toBe(0);
  });

  it("cleans up on stop", async () => {
    const unsubscribe = vi.fn();
    const controller = createRealtimeSubscriptionController({
      domain: "orders",
      scope: { type: "global_staff" },
      changes: [{ event: "*", schema: "public", table: "orders" }],
      mode: "refetch",
      snapshot: async () => {},
      channelAdapter: {
        subscribe: () => ({ unsubscribe }),
      },
    });

    await controller.start();
    controller.stop();
    expect(unsubscribe).toHaveBeenCalled();
    expect(controller.getStatus()).toBe("idle");
  });

  it("enters degraded then unavailable after reconnect exhaustion", async () => {
    const controller = createRealtimeSubscriptionController({
      domain: "orders",
      scope: { type: "global_staff" },
      changes: [{ event: "*", schema: "public", table: "orders" }],
      mode: "refetch",
      snapshot: async () => {},
      maxReconnectAttempts: 2,
      reconnectBackoffMs: 1,
      pollingFallbackMs: 50,
      channelAdapter: makeAdapter(["CHANNEL_ERROR", "CHANNEL_ERROR"]),
    });

    await controller.start();
    expect(controller.getStatus()).toBe("degraded");

    await new Promise((r) => setTimeout(r, 20));
    await controller.reconcile();
    expect(["degraded", "unavailable"]).toContain(controller.getStatus());
  });

  it("throws on unauthorized channel at construction", () => {
    expect(() =>
      createRealtimeSubscriptionController({
        domain: "notifications",
        scope: { type: "global_staff" },
        changes: [],
        mode: "refetch",
        snapshot: async () => {},
        channelAdapter: makeAdapter(["SUBSCRIBED"]),
      }),
    ).toThrow(/fail closed/i);
  });

  it("reconciles snapshot on reconnect path", async () => {
    let snapshots = 0;
    const controller = createRealtimeSubscriptionController({
      domain: "orders",
      scope: { type: "global_staff" },
      changes: [{ event: "*", schema: "public", table: "orders" }],
      mode: "refetch",
      snapshot: async () => {
        snapshots += 1;
      },
      channelAdapter: makeAdapter(["SUBSCRIBED"]),
    });

    await controller.start();
    await controller.reconcile();
    expect(snapshots).toBeGreaterThanOrEqual(2);
  });
});

describe("Point23 payload mapping", () => {
  it("maps postgres row to versioned delta without treating payload as truth", () => {
    const payload = toRealtimeDeltaPayload("orders", {
      id: "o1",
      updated_at: "2026-01-01T00:00:00.000Z",
      status: "submitted",
    });
    expect(payload.entityId).toBe("o1");
    expect(payload.version).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(payload.eventId).toContain("orders:o1");
  });
});

describe("Point23 programme separation", () => {
  it("documents foreign repo prerequisites", () => {
    expect(POINT23_FOREIGN_REPO_PREREQUISITES["oasis-supabase-core"].length).toBeGreaterThan(0);
    expect(POINT23_FOREIGN_REPO_PREREQUISITES["oasis-baklawa"][0]).toMatch(/central:/);
  });

  it("records Central census base SHA", () => {
    expect(CENTRAL_REALTIME_CENSUS.baseSha).toMatch(/^[0-9a-f]{40}$/);
    expect(CENTRAL_REALTIME_CENSUS.separation.point20).toMatch(/event truth/i);
    expect(CENTRAL_REALTIME_CENSUS.separation.point24).toMatch(/retry/i);
  });
});

describe("Point23 scope validation edge cases", () => {
  it("rejects invalid UUIDs fail closed", () => {
    expect(validateRealtimeScope({ type: "user", userId: "not-a-uuid" }).allowed).toBe(false);
  });
});
