import { describe, expect, it } from "vitest";
import { ASSEMBLY_GOVERNED_RPCS, ASSEMBLY_READ_ONLY_RPCS } from "../assemblyRpcCatalog";

describe("assemblyRpcCatalog", () => {
  it("lists every governed Core assembly mutation RPC in lifecycle order", () => {
    expect(ASSEMBLY_GOVERNED_RPCS).toEqual([
      "create_assembly_job",
      "reserve_assembly_components",
      "create_assembly_3pgs_requirement",
      "authorize_partial_assembly_issue",
      "issue_assembly_components",
      "record_assembly_consumption",
      "complete_assembly_job",
      "accept_assembly_output",
      "initiate_assembly_handover",
      "acknowledge_assembly_handover",
      "reconcile_assembly_job",
      "close_assembly_job",
    ]);
  });

  it("keeps read-only helper RPCs separate from mutation authority", () => {
    for (const rpc of ASSEMBLY_READ_ONLY_RPCS) {
      expect(ASSEMBLY_GOVERNED_RPCS).not.toContain(rpc);
    }
  });
});
