import { describe, expect, it } from "vitest";
import { fetchOpenProductionJobsCount, OPEN_PRODUCTION_JOB_STATUSES } from "../openProductionJobsCount";

// Regression coverage for the Command Center "Production" KPI defect: the
// Live Work Queues "Production" card was computed from legacy
// orders.status (productionQueueFeed.ts / isProductionPipelineOrder),
// completely disconnected from the governed production_jobs authority.
// This module provides the authoritative count instead, and must query
// production_jobs (never orders) filtered to open statuses.

function makeClient(response: { count: number | null; error: { message: string } | null }) {
  const calls: { relation?: string; statuses?: string[]; countOption?: unknown } = {};
  return {
    client: {
      from: (relation: string) => {
        calls.relation = relation;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder: any = {};
        builder.select = (_cols: string, opts: unknown) => {
          calls.countOption = opts;
          return builder;
        };
        builder.in = (_col: string, values: string[]) => {
          calls.statuses = values;
          return Promise.resolve(response);
        };
        return builder;
      },
    },
    calls,
  };
}

describe("fetchOpenProductionJobsCount", () => {
  it("queries production_jobs (not orders) filtered to open statuses", async () => {
    const { client, calls } = makeClient({ count: 6, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchOpenProductionJobsCount(client as any);

    expect(calls.relation).toBe("production_jobs");
    expect(calls.statuses).toEqual([...OPEN_PRODUCTION_JOB_STATUSES]);
    expect(calls.countOption).toMatchObject({ count: "exact", head: true });
    expect(result).toEqual({ count: 6, error: null });
  });

  it("never coerces a failed query to 0 -- returns null with the error message", async () => {
    const { client } = makeClient({ count: null, error: { message: "boom" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchOpenProductionJobsCount(client as any);

    expect(result).toEqual({ count: null, error: "boom" });
  });

  it("returns a real 0 (not null) when there are genuinely no open jobs", async () => {
    const { client } = makeClient({ count: 0, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchOpenProductionJobsCount(client as any);

    expect(result).toEqual({ count: 0, error: null });
  });
});
