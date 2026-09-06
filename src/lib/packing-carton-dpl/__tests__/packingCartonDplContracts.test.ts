import { describe, expect, it } from "vitest";
import {
  assertCartonEvidenceBound,
  assertCartonUniqueness,
  assertDplVersionChain,
  assertLockVersionFresh,
  assertQuantityConservation,
  deriveCurrentDplVersion,
  deriveFinanceHandoffEligibility,
  derivePartialPackingState,
  evaluatePackingContracts,
  findDuplicateCartonCodes,
  reconcileLineQuantities,
} from "../packingCartonDplContracts";
import type {
  GovernedCartonItemRow,
  GovernedCartonRow,
  GovernedConsignmentLineRow,
  GovernedDplVersionRow,
} from "../packingCartonDplTypes";

const carton = (overrides: Partial<GovernedCartonRow> = {}): GovernedCartonRow => ({
  id: "c1",
  consignment_id: "cons1",
  carton_code: "CTN-001",
  carton_sequence: 1,
  status: "open",
  net_weight: null,
  gross_weight: null,
  open_photo_ref: null,
  seal_reference: null,
  locked_by: null,
  locked_at: null,
  current_version: 1,
  ...overrides,
});

const line = (overrides: Partial<GovernedConsignmentLineRow> = {}): GovernedConsignmentLineRow => ({
  id: "l1",
  product_code: "SKU-A",
  accepted_ready_qty: 10,
  packed_qty: 10,
  ...overrides,
});

const item = (overrides: Partial<GovernedCartonItemRow> = {}): GovernedCartonItemRow => ({
  id: "i1",
  carton_id: "c1",
  consignment_line_id: "l1",
  order_item_id: "oi1",
  product_code: "SKU-A",
  barcode_value: "BC-1",
  batch_lot: "LOT-1",
  quantity: 10,
  scanned_at: "2026-08-30T00:00:00.000Z",
  ...overrides,
});

const dpl = (overrides: Partial<GovernedDplVersionRow> = {}): GovernedDplVersionRow => ({
  id: "dpl1",
  consignment_id: "cons1",
  version_number: 1,
  status: "generated",
  submitted_to_finance_at: null,
  finance_check_state: "not_requested",
  superseded_by: null,
  generated_at: "2026-08-30T00:00:00.000Z",
  ...overrides,
});

describe("Point92 packing/carton/DPL contracts", () => {
  describe("carton uniqueness", () => {
    it("detects duplicate carton codes case-insensitively", () => {
      const dupes = findDuplicateCartonCodes([
        { id: "a", carton_code: "CTN-001" },
        { id: "b", carton_code: "ctn-001" },
      ]);
      expect(dupes).toContain("ctn-001");
    });

    it("passes when carton codes are unique", () => {
      expect(assertCartonUniqueness([{ id: "a", carton_code: "CTN-001" }, { id: "b", carton_code: "CTN-002" }]).ok).toBe(true);
    });
  });

  describe("quantity conservation", () => {
    it("conserves when scanned totals match authoritative packed_qty", () => {
      const rows = reconcileLineQuantities([line()], [item()]);
      expect(rows[0].conserved).toBe(true);
      expect(assertQuantityConservation([line()], [item()]).ok).toBe(true);
    });

    it("fails on over-pack", () => {
      const result = assertQuantityConservation([line({ packed_qty: 5 })], [item({ quantity: 8 })]);
      expect(result.ok).toBe(false);
      expect(result.violations[0].code).toBe("QUANTITY_OVER_PACK");
    });

    it("fails on under-pack when authoritative qty is set", () => {
      const result = assertQuantityConservation([line({ packed_qty: 10 })], []);
      expect(result.ok).toBe(false);
      expect(result.violations[0].code).toBe("QUANTITY_UNDER_PACK");
    });

    it("supports multi-carton packing across lines", () => {
      const lines = [line({ id: "l1", packed_qty: 6 }), line({ id: "l2", product_code: "SKU-B", packed_qty: 4 })];
      const items = [
        item({ consignment_line_id: "l1", quantity: 3 }),
        item({ id: "i2", carton_id: "c2", consignment_line_id: "l1", quantity: 3 }),
        item({ id: "i3", carton_id: "c2", consignment_line_id: "l2", product_code: "SKU-B", quantity: 4 }),
      ];
      expect(assertQuantityConservation(lines, items).ok).toBe(true);
    });
  });

  describe("partial packing", () => {
    it("marks partial when packed_qty is below accepted_ready_qty", () => {
      const state = derivePartialPackingState([line({ packed_qty: 6, accepted_ready_qty: 10 })], [carton({ status: "locked" })]);
      expect(state.isPartial).toBe(true);
      expect(state.unresolvedLineIds).toContain("l1");
    });

    it("allows DPL generation when all cartons locked and qty packed", () => {
      const state = derivePartialPackingState([line()], [carton({ status: "locked" })]);
      expect(state.canGenerateDpl).toBe(true);
    });

    it("blocks DPL generation when a carton is unlocked", () => {
      const state = derivePartialPackingState([line()], [carton({ status: "open" })]);
      expect(state.canGenerateDpl).toBe(false);
    });
  });

  describe("DPL versioning", () => {
    it("derives current non-superseded version", () => {
      const current = deriveCurrentDplVersion([
        dpl({ version_number: 1, status: "superseded", superseded_by: "dpl2" }),
        dpl({ id: "dpl2", version_number: 2, status: "generated" }),
      ]);
      expect(current?.version_number).toBe(2);
    });

    it("rejects multiple current versions", () => {
      const result = assertDplVersionChain([
        dpl({ id: "a", version_number: 1, status: "generated" }),
        dpl({ id: "b", version_number: 2, status: "generated" }),
      ]);
      expect(result.ok).toBe(false);
      expect(result.violations[0].code).toBe("DPL_MULTIPLE_CURRENT");
    });

    it("requires superseded versions to point to a successor", () => {
      const result = assertDplVersionChain([dpl({ status: "superseded", superseded_by: null })]);
      expect(result.ok).toBe(false);
    });
  });

  describe("stale version rejection", () => {
    it("fails when lock submitted with stale version", () => {
      const result = assertLockVersionFresh(carton({ current_version: 3 }), 2);
      expect(result.ok).toBe(false);
      expect(result.violations[0].code).toBe("STALE_CARTON_VERSION");
    });

    it("passes when versions match", () => {
      expect(assertLockVersionFresh(carton({ current_version: 2 }), 2).ok).toBe(true);
    });
  });

  describe("evidence binding", () => {
    it("requires weight or photo before lock", () => {
      expect(assertCartonEvidenceBound(carton()).ok).toBe(false);
      expect(assertCartonEvidenceBound(carton({ net_weight: 1.2 })).ok).toBe(true);
      expect(assertCartonEvidenceBound(carton({ open_photo_ref: "https://storage/photo.jpg" })).ok).toBe(true);
    });
  });

  describe("Finance handoff", () => {
    it("is eligible when DPL generated and cartons locked", () => {
      const eligibility = deriveFinanceHandoffEligibility(dpl(), [carton({ status: "locked" })]);
      expect(eligibility.eligible).toBe(true);
    });

    it("blocks when DPL already submitted", () => {
      const eligibility = deriveFinanceHandoffEligibility(
        dpl({ submitted_to_finance_at: "2026-08-30T12:00:00.000Z" }),
        [carton({ status: "locked" })],
      );
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.blockers.some((b) => b.includes("submitted"))).toBe(true);
    });

    it("blocks when cartons remain unlocked", () => {
      const eligibility = deriveFinanceHandoffEligibility(dpl(), [carton({ status: "open" })]);
      expect(eligibility.eligible).toBe(false);
    });
  });

  describe("aggregate evaluation", () => {
    it("reports allOk when every contract passes", () => {
      const evaluation = evaluatePackingContracts({
        cartons: [carton({ status: "locked", net_weight: 1 })],
        cartonItems: [item()],
        lines: [line()],
        dplVersions: [dpl()],
      });
      expect(evaluation.allOk).toBe(true);
    });
  });
});
