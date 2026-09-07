import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFinanceGovernanceBundle } from "../createFinanceGovernanceBundle";
import * as financeControlBoundary from "@/lib/order-authority/financeControlBoundary";
import * as supabaseFinanceEvidenceStore from "../supabaseFinanceEvidenceStore";

describe("createFinanceGovernanceBundle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("enables Golden Chain commercial release when finance_review_evidence is probeable without Point80 typed RPCs", async () => {
    vi.spyOn(financeControlBoundary, "resolvePoint80ControlBoundary").mockResolvedValue({
      persistenceMode: "blocked",
      canExecuteTypedWrites: false,
      missingCoreRpcs: ["place_finance_hold_v1"],
      prerequisiteMessage: "Point80 typed control unavailable",
    });
    vi.spyOn(supabaseFinanceEvidenceStore, "probeFinanceEvidenceTable").mockResolvedValue(true);

    const bundle = await createFinanceGovernanceBundle({} as never);

    expect(bundle.persistenceMode).toBe("supabase");
    expect(bundle.canExecuteWrites).toBe(false);
    expect(bundle.canExecuteCommercialRelease).toBe(true);
    expect(bundle.point80ControlMode).toBe("blocked");
    expect(bundle.corePrerequisiteMessage).toContain("Point80 typed control unavailable");
  });
});
