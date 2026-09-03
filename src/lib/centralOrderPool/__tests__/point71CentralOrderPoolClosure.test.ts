import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CENTRAL_ORDER_POOL_CANONICAL_ROUTE,
  CENTRAL_ORDER_POOL_ROUTE_CENSUS,
} from "@/lib/centralOrderPool/centralOrderPoolRouteCensus";
import { bucketOrderStatusCounts } from "@/lib/centralOrderPool/centralOrderPoolSnapshotLoader";
import { centralOrderPoolMetrics } from "@/lib/centralOrderPool/centralOrderPoolModel";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("POINT71 Central Order Pool closure", () => {
  it("declares a single canonical route in the census", () => {
    const canonical = CENTRAL_ORDER_POOL_ROUTE_CENSUS.filter((entry) => entry.disposition === "canonical");
    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.path).toBe(CENTRAL_ORDER_POOL_CANONICAL_ROUTE);
  });

  it("retires legacy /admin/orders behind the canonical hub redirect", () => {
    const app = source("src/App.tsx");
    expect(app).toContain('<Route path="orders" element={<Navigate to="/admin/central-pool" replace />} />');
    expect(app).not.toContain('path="orders" element={<AdminOrders');
  });

  it("mounts the governed composition hub at /admin/central-pool", () => {
    const app = source("src/App.tsx");
    expect(app).toContain("CentralOrderPoolCommandCentre");
    expect(app).toContain('path="central-pool"');
    expect(app).not.toMatch(/import\("\.\/pages\/admin\/CentralOrderPool\.tsx"\)/);
  });

  it("redirects retired cmd-war-room bookmarks to the canonical hub", () => {
    const app = source("src/App.tsx");
    expect(app).toContain('<Route path="cmd-war-room" element={<Navigate to="/admin/central-pool" replace />} />');
  });

  it("keeps the legacy CentralOrderPool page unmounted and promotion retired", () => {
    const legacy = source("src/pages/admin/CentralOrderPool.tsx");
    expect(legacy).toContain("Central Pool promotion is retired");
    expect(legacy).not.toContain('.from("orders")');
  });

  it("buckets production and packing counts without overlapping mutation surfaces", () => {
    const counts = bucketOrderStatusCounts([
      "confirmed",
      "in_production",
      "packing",
      "packed_ready",
    ]);
    expect(counts).toEqual({ productionActive: 2, packingActive: 2 });
    const metrics = centralOrderPoolMetrics({
      intakePending: 1,
      intakeClarification: 2,
      pipelineSubmitted: 3,
      pipelineConfirmed: 4,
      productionActive: 5,
      packingActive: 6,
      recentOrders: [],
    });
    expect(metrics.intakeOpen).toBe(3);
    expect(metrics.pipelineOpen).toBe(7);
  });
});
