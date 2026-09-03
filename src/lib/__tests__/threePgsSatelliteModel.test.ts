import { describe, expect, it } from "vitest";
import { EMPTY_THREE_PGS_SNAPSHOT } from "@/pages/admin/threePgsCommandCentreModel";
import {
  buildThreePgsMobileUrgentItems,
  buildThreePgsTvLanes,
  projectThreePgsSatellite,
} from "@/lib/threePgsSatelliteModel";

describe("projectThreePgsSatellite", () => {
  const snapshot = {
    ...EMPTY_THREE_PGS_SNAPSHOT,
    demand: [
      {
        demand_id: "d1",
        demand_reference: "PNA-1",
        demand_source_type: "pna",
        priority_rank: 1,
        sku: "BOX-1",
        location_code: "3PGS",
        outstanding_qty: 4,
      },
      {
        demand_id: "d2",
        demand_reference: "OUT-1",
        demand_source_type: "outlet",
        priority_rank: 2,
        sku: "BOX-2",
        location_code: "3PGS",
        outstanding_qty: 3,
      },
      {
        demand_id: "d3",
        demand_reference: "B2B-1",
        demand_source_type: "b2b",
        priority_rank: 3,
        sku: "BOX-3",
        location_code: "3PGS",
        outstanding_qty: 2,
      },
    ],
    assembly: [
      {
        id: "a1",
        requirement_number: "A-1",
        sku: "BOX-1",
        source_store_code: "3PGS",
        requested_qty: 4,
        fulfilled_qty: 1,
        status: "partially_fulfilled",
        priority: "urgent",
      },
    ],
  };

  it("filters P&A satellite demand to pna rows and keeps assembly requirements", () => {
    const projection = projectThreePgsSatellite(snapshot, "pna");
    expect(projection.demand).toHaveLength(1);
    expect(projection.demand[0]?.demand_source_type).toBe("pna");
    expect(projection.assembly).toHaveLength(1);
  });

  it("filters outlet satellite demand to outlet rows only", () => {
    const projection = projectThreePgsSatellite(snapshot, "outlet");
    expect(projection.demand).toHaveLength(1);
    expect(projection.demand[0]?.demand_source_type).toBe("outlet");
    expect(projection.assembly).toHaveLength(0);
  });

  it("filters sales satellite demand to b2b rows only", () => {
    const projection = projectThreePgsSatellite(snapshot, "b2b");
    expect(projection.demand).toHaveLength(1);
    expect(projection.demand[0]?.demand_source_type).toBe("b2b");
  });

  it("keeps dispatch and management projections on the full demand set", () => {
    expect(projectThreePgsSatellite(snapshot, "dispatch").demand).toHaveLength(3);
    expect(projectThreePgsSatellite(snapshot, "management").demand).toHaveLength(3);
  });
});

describe("buildThreePgsMobileUrgentItems", () => {
  it("prioritises governed demand, assembly and receipts awaiting GRN", () => {
    const items = buildThreePgsMobileUrgentItems({
      ...EMPTY_THREE_PGS_SNAPSHOT,
      demand: [
        {
          demand_id: "d1",
          demand_reference: "PNA-1",
          demand_source_type: "pna",
          priority_rank: 1,
          sku: "BOX-1",
          location_code: "3PGS",
          outstanding_qty: 4,
        },
      ],
      assembly: [
        {
          id: "a1",
          requirement_number: "A-1",
          sku: "BOX-2",
          source_store_code: "3PGS",
          requested_qty: 2,
          fulfilled_qty: 0,
          status: "open",
          priority: "urgent",
        },
      ],
      receipts: [
        {
          id: "r1",
          receipt_number: "R-1",
          destination_store_code: "3PGS",
          status: "accepted",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      grns: [],
    });

    expect(items.map((item) => item.kind)).toEqual(["demand", "assembly", "receipt"]);
  });
});

describe("buildThreePgsTvLanes", () => {
  it("projects TV lanes from command-centre metrics without inventing state", () => {
    const lanes = buildThreePgsTvLanes({
      ...EMPTY_THREE_PGS_SNAPSHOT,
      balances: [
        {
          id: "b1",
          sku: "BOX-1",
          location_code: "3PGS",
          available_qty: 10,
          reserved_qty: 2,
          picked_qty: 0,
          damaged_qty: 1,
          expired_qty: 0,
          quarantine_qty: 0,
        },
      ],
    });

    expect(lanes.find((lane) => lane.key === "available")?.value).toBe(10);
    expect(lanes.find((lane) => lane.key === "reserved")?.value).toBe(2);
    expect(lanes.find((lane) => lane.key === "exceptions")?.value).toBe(1);
  });
});
