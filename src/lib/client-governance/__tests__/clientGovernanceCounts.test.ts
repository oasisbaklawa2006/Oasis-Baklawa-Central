import { describe, expect, it } from "vitest";
import { fetchClientGovernanceCounts } from "../clientGovernanceCounts";

// Regression coverage for Admin Clients KPI staleness: after approve/reject
// mutations the pending tab list refreshed via fetchApps but summary KPI cards
// (Pending Review / Recently Approved / Total Active Directory) were only
// loaded once on mount. This module is the authoritative count source.

type CountResponse = { count: number | null; error: { message: string } | null };

function makeClient(responses: {
  pending: CountResponse;
  approved: CountResponse;
  active: CountResponse;
}) {
  const calls: string[] = [];
  const client = {
    from: (relation: string) => {
      calls.push(relation);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      builder.select = (_cols: string, opts: unknown) => {
        builder._opts = opts;
        return builder;
      };
      builder.eq = (_col: string, value: string) => {
        builder._status = value;
        return builder;
      };
      builder.then = undefined;
      const resolve = () => {
        if (relation === "b2b_applications" && builder._status === "pending") {
          return Promise.resolve(responses.pending);
        }
        if (relation === "b2b_applications" && builder._status === "approved") {
          return Promise.resolve(responses.approved);
        }
        if (relation === "companies") {
          return Promise.resolve(responses.active);
        }
        return Promise.resolve({ count: null, error: { message: "unexpected query" } });
      };
      builder.eq = (_col: string, value: string) => {
        builder._status = value;
        return resolve();
      };
      if (relation === "companies") {
        return {
          select: (_cols: string, _opts: unknown) => resolve(),
        };
      }
      return builder;
    },
  };
  return { client, calls };
}

describe("fetchClientGovernanceCounts", () => {
  it("queries b2b_applications pending/approved and companies active counts", async () => {
    const { client, calls } = makeClient({
      pending: { count: 2, error: null },
      approved: { count: 5, error: null },
      active: { count: 12, error: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchClientGovernanceCounts(client as any);

    expect(calls).toContain("b2b_applications");
    expect(calls).toContain("companies");
    expect(result).toEqual({
      counts: { pending: 2, approved: 5, active: 12 },
      error: null,
    });
  });

  it("returns null counts with error message when a query fails", async () => {
    const { client } = makeClient({
      pending: { count: null, error: { message: "rls denied" } },
      approved: { count: 3, error: null },
      active: { count: 1, error: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchClientGovernanceCounts(client as any);

    expect(result).toEqual({ counts: null, error: "rls denied" });
  });

  it("returns real zeros when there are genuinely no pending applications", async () => {
    const { client } = makeClient({
      pending: { count: 0, error: null },
      approved: { count: 1, error: null },
      active: { count: 1, error: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchClientGovernanceCounts(client as any);

    expect(result).toEqual({
      counts: { pending: 0, approved: 1, active: 1 },
      error: null,
    });
  });
});
