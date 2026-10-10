import { describe, expect, it } from "vitest";
import { laneByKey } from "../departmentQueueRoutingContract";
import {
  dedupeCanonicalQueueItems,
  mapProductionJobsToQueueItems,
  mapReservationsToQueueItems,
} from "../mapCanonicalQueueRows";

describe("mapCanonicalQueueRows (Point86)", () => {
  const productionLane = laneByKey("production")!;

  it("maps production_jobs to queue items with Core priority provenance", () => {
    const items = mapProductionJobsToQueueItems(productionLane, [
      {
        id: "job-1",
        order_id: "order-1",
        status: "pending",
        priority: "urgent",
        department: "Arabic Sweets",
        canonical_department: "ARABIC_SWEETS",
        assigned_to: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].priority).toBe("urgent");
    expect(items[0].ownerDepartment).toBe("ARABIC_SWEETS");
    expect(items[0].idempotencyKey).toBe("production_job:job-1");
    expect(items[0].sourceRelation).toBe("production_jobs");
  });

  it("excludes terminal production jobs — closed work does not reappear", () => {
    const items = mapProductionJobsToQueueItems(productionLane, [
      {
        id: "job-done",
        order_id: "order-1",
        status: "completed",
        priority: "normal",
        department: "Bakery",
        canonical_department: "BAKERY",
        assigned_to: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "job-open",
        order_id: "order-2",
        status: "in_production",
        priority: "normal",
        department: "Bakery",
        canonical_department: "BAKERY",
        assigned_to: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ]);
    expect(items.map((i) => i.sourceRowId)).toEqual(["job-open"]);
  });

  it("isolates departments via ownerDepartment from canonical_department", () => {
    const arabic = mapProductionJobsToQueueItems(productionLane, [
      {
        id: "a",
        order_id: null,
        status: "pending",
        priority: "normal",
        department: "Arabic Sweets",
        canonical_department: "ARABIC_SWEETS",
        assigned_to: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const bakery = mapProductionJobsToQueueItems(productionLane, [
      {
        id: "b",
        order_id: null,
        status: "pending",
        priority: "normal",
        department: "Bakery",
        canonical_department: "BAKERY",
        assigned_to: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(arabic[0].ownerDepartment).not.toBe(bakery[0].ownerDepartment);
  });

  it("dedupes by idempotency key — no duplicate queue items", () => {
    const readyLane = laneByKey("ready_goods")!;
    const dupes = dedupeCanonicalQueueItems([
      ...mapReservationsToQueueItems(
        readyLane,
        [
          {
            id: "res-1",
            order_id: "o1",
            customer_id: null,
            sku: "SKU-A",
            reservation_status: "active",
            reservation_priority: "high",
            source_department: "RGS",
            expires_at: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        "inventory_verification_queue",
      ),
      ...mapReservationsToQueueItems(
        readyLane,
        [
          {
            id: "res-1",
            order_id: "o1",
            customer_id: null,
            sku: "SKU-A",
            reservation_status: "active",
            reservation_priority: "high",
            source_department: "RGS",
            expires_at: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        "inventory_verification_queue",
      ),
    ]);
    expect(dupes).toHaveLength(1);
  });

  it("maps SLA from reservation expires_at — not client-invented", () => {
    const readyLane = laneByKey("ready_goods")!;
    const items = mapReservationsToQueueItems(
      readyLane,
      [
        {
          id: "res-1",
          order_id: "o1",
          customer_id: null,
          sku: "SKU-A",
          reservation_status: "active",
          reservation_priority: "high",
          source_department: "RGS",
          expires_at: "2026-02-01T12:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      "inventory_verification_queue",
    );
    expect(items[0].slaDueAt).toBe("2026-02-01T12:00:00Z");
  });
});
