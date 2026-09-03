import { describe, expect, it } from "vitest";
import { EMPTY_THREE_PGS_SNAPSHOT } from "@/pages/admin/threePgsCommandCentreModel";
import { applyThreePgsSnapshotLoadResult } from "@/lib/threePgsSnapshotLoader";

const loadedSnapshot = {
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
};

describe("applyThreePgsSnapshotLoadResult", () => {
  it("replaces the snapshot when a refresh succeeds", () => {
    expect(
      applyThreePgsSnapshotLoadResult(EMPTY_THREE_PGS_SNAPSHOT, {
        snapshot: loadedSnapshot,
        error: null,
      }),
    ).toEqual(loadedSnapshot);
  });

  it("preserves the last successful snapshot when a refresh fails", () => {
    expect(
      applyThreePgsSnapshotLoadResult(loadedSnapshot, {
        snapshot: null,
        error: "network error",
      }),
    ).toEqual(loadedSnapshot);
  });

  it("keeps the empty snapshot on an initial-load failure", () => {
    expect(
      applyThreePgsSnapshotLoadResult(EMPTY_THREE_PGS_SNAPSHOT, {
        snapshot: null,
        error: "network error",
      }),
    ).toEqual(EMPTY_THREE_PGS_SNAPSHOT);
  });
});
