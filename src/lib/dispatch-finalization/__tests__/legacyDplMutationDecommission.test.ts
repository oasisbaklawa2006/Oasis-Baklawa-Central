import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");

// Codacy/taint analyzers flag a generic readSrc(relative: string) helper that
// forwards a runtime path to readFileSync as a path-traversal candidate, even
// though every call site in this file passes a fixed literal. Each file this
// test reads gets its own literal readFileSync call instead, so there is no
// runtime/path string flowing into a filesystem API anywhere in this file.
function readDispatchManagement(): string {
  return readFileSync(join(ROOT, "pages/admin/DispatchManagement.tsx"), "utf8");
}

function readAdminPackingDispatch(): string {
  return readFileSync(join(ROOT, "pages/admin/AdminPackingDispatch.tsx"), "utf8");
}

function readAdminAccountsRelease(): string {
  return readFileSync(join(ROOT, "pages/admin/AdminAccountsRelease.tsx"), "utf8");
}

function readApp(): string {
  return readFileSync(join(ROOT, "App.tsx"), "utf8");
}

describe("FACT-C3 legacy carton/DPL mutation decommission", () => {
  it("DispatchManagement no longer writes the legacy dispatch_cartons table", () => {
    const src = readDispatchManagement();
    expect(src).not.toMatch(/from\(["']dispatch_cartons["']\)\.insert/);
  });

  it("DispatchManagement no longer updates order_items.actual_packed_qty directly", () => {
    const src = readDispatchManagement();
    expect(src).not.toMatch(/from\(["']order_items["']\)\.update/);
    expect(src).not.toMatch(/\.update\(\{[^}]*actual_packed_qty/);
  });

  it("DispatchManagement no longer contains the legacy no-op Finalize DPL order-status flip", () => {
    const src = readDispatchManagement();
    expect(src).not.toContain("handleFinalizeDpl");
    expect(src).not.toContain("DPL_FINALIZED");
    expect(src).not.toMatch(/from\(["']orders["']\)\.update\(\{[^}]*status:\s*["']awaiting_final_payment["']/);
  });

  it("DispatchManagement is wired to the full governed FACT-C1/FACT-C2 RPC chain", () => {
    const src = readDispatchManagement();
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
    expect(existsSync(join(ROOT, "pages/admin/DispatchGovernedExecutionPreview.tsx"))).toBe(false);
    const app = readApp();
    expect(app).not.toContain("DispatchGovernedExecutionPreview");
    expect(app).not.toContain("dispatch-governed-preview");
  });

  it("DispatchManagement never mutates b2b_dispatch_packing_list_versions with a raw INSERT/UPDATE", () => {
    // A grep-equivalent static check: the governed table name should never
    // appear adjacent to a raw .insert/.update/.upsert/.delete call.
    const src = readDispatchManagement();
    expect(src).not.toMatch(/from\(["']b2b_dispatch_packing_list_versions["']\)\.(insert|update|upsert|delete)/);
  });

  it("DispatchManagement is the only routed B2B carton/DPL/packed-qty mutation authority -- no legacy writer performs these writes", () => {
    // FACT-C3 correction: AdminPackingDispatch and AdminAccountsRelease
    // previously created legacy dispatches/packing_lists/dispatch_cartons
    // and updated order_items.actual_packed_qty/final_weight_kg directly --
    // a second, competing B2B authority. Both are now fail-closed and
    // redirect to the governed DispatchManagement flow via
    // blockLegacyB2bCartonDplMutation instead of performing these writes.
    for (const src of [readAdminPackingDispatch(), readAdminAccountsRelease()]) {
      expect(src).not.toMatch(/from\(["']dispatches["']\)\.insert/);
      expect(src).not.toMatch(/from\(["']packing_lists["']\)\.insert/);
      expect(src).not.toMatch(/from\(["']dispatch_cartons["']\)\.insert/);
      expect(src).not.toMatch(/\.update\(\{[^}]*actual_packed_qty/);
      expect(src).not.toMatch(/\.update\(\{[^}]*final_weight_kg/);
      expect(src).toContain("blockLegacyB2bCartonDplMutation");
    }
  });
});
