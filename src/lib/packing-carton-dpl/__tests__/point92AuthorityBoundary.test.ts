import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  AUTHORITATIVE_PACKING_RELATIONS,
  GOVERNED_PACKING_CARTON_DPL_RPCS,
  LEGACY_PACKING_RELATIONS_BLOCKED,
  PACKING_MUTATION_SURFACE,
  PACKING_READ_ONLY_SURFACES,
} from "../packingAuthorityBoundary";

const ROOT = join(import.meta.dirname, "../../..");

function readSrc(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("Point92 Central packing/carton/DPL authority boundary", () => {
  it("declares DispatchManagement as the sole mutation surface", () => {
    expect(PACKING_MUTATION_SURFACE).toBe("DispatchManagement");
    expect(PACKING_READ_ONLY_SURFACES).toContain("CartonExplorer");
    expect(PACKING_READ_ONLY_SURFACES).toContain("ScanTimeline");
    expect(PACKING_READ_ONLY_SURFACES).toContain("DispatchTV");
  });

  it("lists the full governed Core RPC chain", () => {
    expect(GOVERNED_PACKING_CARTON_DPL_RPCS).toEqual([
      "create_b2b_dispatch_consignment",
      "open_b2b_dispatch_carton",
      "record_b2b_dispatch_carton_item_scan",
      "record_b2b_dispatch_carton_evidence",
      "lock_b2b_dispatch_carton",
      "create_b2b_dispatch_packing_list",
      "supersede_b2b_dispatch_packing_list",
      "submit_b2b_dispatch_packing_list_to_finance",
    ]);
  });

  it("CartonExplorer is read-only — no governed RPC or direct writes", () => {
    const src = readSrc("pages/admin/CartonExplorer.tsx");
    for (const rpc of GOVERNED_PACKING_CARTON_DPL_RPCS) {
      expect(src).not.toContain(rpc);
    }
    for (const relation of [...AUTHORITATIVE_PACKING_RELATIONS, ...LEGACY_PACKING_RELATIONS_BLOCKED]) {
      expect(src).not.toMatch(new RegExp(`from\\(["']${relation}["']\\)\\.(insert|update|upsert|delete)`));
    }
    expect(src).toContain("Read-only");
    expect(src).toContain("useCartonExplorer");
  });

  it("ScanTimeline remains read-only for packing mutations", () => {
    const src = readSrc("pages/admin/ScanTimeline.tsx");
    for (const rpc of GOVERNED_PACKING_CARTON_DPL_RPCS) {
      expect(src).not.toContain(rpc);
    }
  });

  it("DispatchTV remains read-only for packing mutations", () => {
    const src = readSrc("pages/admin/DispatchTV.tsx");
    for (const rpc of GOVERNED_PACKING_CARTON_DPL_RPCS) {
      expect(src).not.toContain(rpc);
    }
    expect(src).not.toMatch(/from\(["']b2b_dispatch_/);
  });

  it("DispatchManagement owns the governed RPC chain exclusively among packing surfaces", () => {
    const dispatch = readSrc("pages/admin/DispatchManagement.tsx");
    for (const rpc of GOVERNED_PACKING_CARTON_DPL_RPCS) {
      expect(dispatch).toContain(rpc);
    }
    const cartonExplorer = readSrc("pages/admin/CartonExplorer.tsx");
    expect(cartonExplorer).not.toContain("dispatchGovernedRpc");
  });

  it("legacy AdminPackingDispatch remains fail-closed for carton/DPL mutations", () => {
    const packing = readSrc("pages/admin/AdminPackingDispatch.tsx");
    expect(packing).toContain("blockLegacyB2bCartonDplMutation");
    for (const relation of LEGACY_PACKING_RELATIONS_BLOCKED) {
      expect(packing).not.toMatch(new RegExp(`from\\(["']${relation}["']\\)\\.insert`));
    }
  });

  it("CartonExplorer no longer advertises internal preview-only mode", () => {
    const src = readSrc("pages/admin/CartonExplorer.tsx");
    expect(src).not.toContain("Internal preview");
    expect(src).not.toContain("not live data");
    expect(src).toContain("b2b_dispatch");
  });

  it("useCartonExplorer reads governed relations only", () => {
    expect(existsSync(join(ROOT, "hooks/useCartonExplorer.ts"))).toBe(true);
    const hook = readSrc("hooks/useCartonExplorer.ts");
    expect(hook).toContain("b2b_dispatch_shipment_execution_view");
    expect(hook).toContain("b2b_dispatch_cartons");
    expect(hook).not.toMatch(/\.rpc\(/);
  });
});
