import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");

function readSrc(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("FACT-C3 legacy carton/DPL mutation decommission", () => {
  it("DispatchManagement no longer writes the legacy dispatch_cartons table", () => {
    const src = readSrc("pages/admin/DispatchManagement.tsx");
    expect(src).not.toMatch(/from\(["']dispatch_cartons["']\)\.insert/);
  });

  it("DispatchManagement no longer updates order_items.actual_packed_qty directly", () => {
    const src = readSrc("pages/admin/DispatchManagement.tsx");
    expect(src).not.toMatch(/from\(["']order_items["']\)\.update/);
    expect(src).not.toMatch(/\.update\(\{[^}]*actual_packed_qty/);
  });

  it("DispatchManagement no longer contains the legacy no-op Finalize DPL order-status flip", () => {
    const src = readSrc("pages/admin/DispatchManagement.tsx");
    expect(src).not.toContain("handleFinalizeDpl");
    expect(src).not.toContain("DPL_FINALIZED");
    expect(src).not.toMatch(/from\(["']orders["']\)\.update\(\{[^}]*status:\s*["']awaiting_final_payment["']/);
  });

  it("DispatchManagement is wired to the full governed FACT-C1/FACT-C2 RPC chain", () => {
    const src = readSrc("pages/admin/DispatchManagement.tsx");
    for (const rpc of [
      "create_b2b_dispatch_consignment",
      "open_b2b_dispatch_carton",
      "record_b2b_dispatch_carton_item_scan",
      "record_b2b_dispatch_carton_evidence",
      "lock_b2b_dispatch_carton",
      "create_b2b_dispatch_packing_list",
      "supersede_b2b_dispatch_packing_list",
      "submit_b2b_dispatch_packing_list_to_finance",
    ]) {
      expect(src).toContain(rpc);
    }
  });

  it("the retired governed-preview page and route no longer exist", () => {
    expect(() => readSrc("pages/admin/DispatchGovernedExecutionPreview.tsx")).toThrow();
    const app = readSrc("App.tsx");
    expect(app).not.toContain("DispatchGovernedExecutionPreview");
    expect(app).not.toContain("dispatch-governed-preview");
  });

  it("DispatchManagement never mutates b2b_dispatch_packing_list_versions with a raw INSERT/UPDATE", () => {
    // A grep-equivalent static check: the governed table name should never
    // appear adjacent to a raw .insert/.update/.upsert/.delete call.
    const src = readSrc("pages/admin/DispatchManagement.tsx");
    expect(src).not.toMatch(/from\(["']b2b_dispatch_packing_list_versions["']\)\.(insert|update|upsert|delete)/);
  });

  it("known out-of-scope legacy writers are unchanged and not silently duplicated by this workflow (documented, not fixed here)", () => {
    // AdminPackingDispatch's packing_lists write is a separate, entangled
    // partial-leg-dispatch/wallet-reconciliation legacy surface explicitly
    // out of FACT-C3's "no transporter/loading/departure" boundary -- it is
    // deliberately left untouched and is not a second B2B DPL authority for
    // the governed consignment/carton/DPL chain this PR wires.
    const packing = readSrc("pages/admin/AdminPackingDispatch.tsx");
    expect(packing).toContain('from("packing_lists").insert');
    const dispatchManagement = readSrc("pages/admin/DispatchManagement.tsx");
    expect(dispatchManagement).not.toMatch(/from\(["']packing_lists["']\)\.insert/);
  });
});
