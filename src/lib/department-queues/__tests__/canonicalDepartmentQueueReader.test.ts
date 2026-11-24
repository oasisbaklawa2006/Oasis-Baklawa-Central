import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanonicalDepartmentQueueItems } from "../canonicalDepartmentQueueReader";

function makeChain(finalData: unknown[] = [], error: { message: string } | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: { data: unknown[]; error: typeof error }) => void) =>
      resolve({ data: finalData, error }),
  };
  return chain;
}

function mockClient(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from: (relation: string) => makeChain(tables[relation] ?? []),
  } as unknown as SupabaseClient;
}

describe("fetchCanonicalDepartmentQueueItems (Point86)", () => {
  it("reads canonical Core relations and quarantines operational_queue_items", async () => {
    const client = mockClient({
      production_jobs: [
        {
          id: "pj-1",
          order_id: "o-1",
          status: "pending",
          priority: "urgent",
          department: "Bakery",
          canonical_department: "BAKERY",
          assigned_to: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      b2b_assembly_jobs: [],
      inventory_reservations: [],
      b2b_dispatch_consignments: [],
      b2b_procurement_requirements: [],
    });

    const result = await fetchCanonicalDepartmentQueueItems(client);
    expect(result.quarantinedLegacyRelation).toBe("operational_queue_items");
    expect(result.items.some((i) => i.sourceRelation === "production_jobs")).toBe(true);
  });

  it("reports blocked lanes with exact Core prerequisites", async () => {
    const client = mockClient({
      production_jobs: [],
      b2b_assembly_jobs: [],
      inventory_reservations: [],
      b2b_dispatch_consignments: [],
      b2b_procurement_requirements: [],
    });

    const result = await fetchCanonicalDepartmentQueueItems(client);
    expect(result.blockedLanes.map((b) => b.laneKey).sort()).toEqual(["complaints", "retail"]);
    for (const blocked of result.blockedLanes) {
      expect(blocked.prerequisite).toMatch(/Core/);
    }
  });

  it("never calls operational_queue_items — no shadow ledger read", async () => {
    const fromSpy = vi.fn((relation: string) => makeChain([]));
    const client = { from: fromSpy } as unknown as SupabaseClient;
    await fetchCanonicalDepartmentQueueItems(client);
    const relations = fromSpy.mock.calls.map((c) => c[0]);
    expect(relations).not.toContain("operational_queue_items");
    expect(relations).toContain("production_jobs");
  });
  it.each([
    "b2b_assembly_jobs",
    "inventory_reservations",
    "b2b_dispatch_consignments",
    "b2b_procurement_requirements",
  ])("fails closed instead of showing zero demand when %s is missing", async (missingRelation) => {
    const fromSpy = vi.fn((relation: string) =>
      makeChain([], relation === missingRelation
        ? { message: `relation "${relation}" does not exist` }
        : null),
    );
    const client = { from: fromSpy } as unknown as SupabaseClient;

    await expect(fetchCanonicalDepartmentQueueItems(client)).rejects.toThrow(
      `${missingRelation} read failed: relation "${missingRelation}" does not exist`,
    );
    expect(fromSpy).not.toHaveBeenCalledWith("operational_queue_items");
  });

  it("surfaces a Core permissions error rather than claiming an empty dispatch queue", async () => {
    const client = {
      from: (relation: string) => makeChain([], relation === "b2b_dispatch_consignments"
        ? { message: "permission denied for table b2b_dispatch_consignments" }
        : null),
    } as unknown as SupabaseClient;
    await expect(fetchCanonicalDepartmentQueueItems(client)).rejects.toThrow(
      "b2b_dispatch_consignments read failed: permission denied",
    );
  });

});
