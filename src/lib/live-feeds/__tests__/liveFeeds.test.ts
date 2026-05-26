import { describe, expect, it } from "vitest";
import { buildFinanceQueueFeed } from "../financeQueueFeed";
import { aggregateLiveFeeds } from "../aggregateLiveFeeds";
import type { OperationalFeedContext } from "../feedTypes";
import { projectWorkQueues } from "@/lib/work-queues/queueProjection";

const baseCtx = (orders: OperationalFeedContext["orders"]): OperationalFeedContext => ({
  orders,
  loadedAt: new Date().toISOString(),
  orderQueryError: null,
});

describe("live feed adapters", () => {
  it("finance feed returns explicit pressure only", () => {
    const feed = buildFinanceQueueFeed(
      baseCtx([
        {
          id: "o1",
          status: "submitted",
          payment_status: "pending",
          advance_paid: 0,
          advance_required: 100,
          created_at: new Date().toISOString(),
          sales_order_value: 1000,
        },
      ]),
    );
    expect(feed.pressureCount).toBe(1);
    expect(feed.items).toHaveLength(1);
    expect(feed.source).toContain("financeQueueFeed");
  });

  it("fails safely with empty items on error", () => {
    const feed = buildFinanceQueueFeed({
      orders: [],
      loadedAt: new Date().toISOString(),
      orderQueryError: "network error",
    });
    expect(feed.items).toHaveLength(0);
    expect(feed.pressureCount).toBeNull();
    expect(feed.warnings.length).toBeGreaterThan(0);
  });

  it("aggregate feeds never invent adapter mutation methods", () => {
    const agg = aggregateLiveFeeds(baseCtx([]));
    expect(agg.snapshots.length).toBeGreaterThan(0);
    expect(typeof (agg as { insert?: unknown }).insert).toBe("undefined");
  });

  it("projectWorkQueues keeps null pressure when feeds pass explicit null", () => {
    const snapshots = projectWorkQueues({
      itemsByQueue: { production_queue: [{ id: "p1", queueId: "production_queue", title: "P", entityId: "x" }] },
      pressureByQueue: { production_queue: null },
    });
    expect(snapshots.find((s) => s.queueId === "production_queue")?.pressureCount).toBeNull();
  });
});
