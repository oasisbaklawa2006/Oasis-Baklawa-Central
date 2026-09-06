import { describe, expect, it } from "vitest";
import { fetchClientGovernanceCounts } from "../clientGovernanceCounts";

// Behavioral regression: after a successful approve mutation the pending tab list
// and KPI cards must converge on the same backend truth. This simulates mount-time
// counts (1 pending) followed by a post-mutation refetch (0 pending, +1 approved).

type CountResponse = { count: number | null; error: { message: string } | null };
type Snapshot = { pending: CountResponse; approved: CountResponse; active: CountResponse };

function makeSequentialClient(responses: Snapshot[]) {
  let fromCallCount = 0;
  const snapshotIndex = () => Math.min(Math.floor(fromCallCount / 3), responses.length - 1);

  const client = {
    from: (relation: string) => {
      const snapshot = responses[snapshotIndex()];
      fromCallCount += 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {
        select: (_cols: string, _opts: unknown) => builder,
        eq: (_col: string, value: string) => {
          if (relation === "b2b_applications" && value === "pending") {
            return Promise.resolve(snapshot.pending);
          }
          if (relation === "b2b_applications" && value === "approved") {
            return Promise.resolve(snapshot.approved);
          }
          return Promise.resolve({ count: null, error: { message: "unexpected status filter" } });
        },
      };

      if (relation === "companies") {
        return {
          select: (_cols: string, _opts: unknown) => Promise.resolve(snapshot.active),
        };
      }

      return builder;
    },
  };

  return { client };
}

describe("fetchClientGovernanceCounts post-mutation convergence", () => {
  it("returns decremented pending and incremented approved on refetch after approval", async () => {
    const { client } = makeSequentialClient([
      {
        pending: { count: 1, error: null },
        approved: { count: 4, error: null },
        active: { count: 9, error: null },
      },
      {
        pending: { count: 0, error: null },
        approved: { count: 5, error: null },
        active: { count: 10, error: null },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = await fetchClientGovernanceCounts(client as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const after = await fetchClientGovernanceCounts(client as any);

    expect(before.counts).toEqual({ pending: 1, approved: 4, active: 9 });
    expect(after.counts).toEqual({ pending: 0, approved: 5, active: 10 });
  });

  it("does not mutate counts when refetch fails after a failed rejection RPC", async () => {
    const { client } = makeSequentialClient([
      {
        pending: { count: 2, error: null },
        approved: { count: 1, error: null },
        active: { count: 3, error: null },
      },
      {
        pending: { count: null, error: { message: "rls denied" } },
        approved: { count: 1, error: null },
        active: { count: 3, error: null },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = await fetchClientGovernanceCounts(client as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const failedRefresh = await fetchClientGovernanceCounts(client as any);

    expect(before.counts).toEqual({ pending: 2, approved: 1, active: 3 });
    expect(failedRefresh).toEqual({ counts: null, error: "rls denied" });
  });
});
