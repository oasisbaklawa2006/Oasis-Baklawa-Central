import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");

function readSrc(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("Phase 4F legacy dispatch decommission", () => {
  it("AdminPackingDispatch does not set orders.status to dispatched", () => {
    const src = readSrc("pages/admin/AdminPackingDispatch.tsx");
    expect(src).not.toMatch(/from\(["']orders["']\)\.update\(\{[^}]*status:\s*["']dispatched["']/);
    expect(src).not.toContain("notifyOrderDispatched");
    expect(src).toContain("blockLegacyDispatchStatusMutation");
    expect(src).toContain("Record partial leg");
  });

  it("AdminSecurityGate does not set orders.status to dispatched", () => {
    const src = readSrc("pages/admin/AdminSecurityGate.tsx");
    expect(src).not.toMatch(/from\(["']orders["']\)\.update\(\{[^}]*status:\s*["']dispatched["']/);
    expect(src).not.toContain("sendDispatchAlert");
  });

  it("AdminAccountsRelease does not set orders.status to dispatched", () => {
    const src = readSrc("pages/admin/AdminAccountsRelease.tsx");
    expect(src).not.toMatch(/status:\s*["']dispatched["'][^}]*\)\.eq\(/);
    expect(src).not.toContain("notifyOrderDispatched");
  });

  it("OrderManagement blocks pipeline dispatched transition", () => {
    const src = readSrc("pages/admin/OrderManagement.tsx");
    expect(src).toContain('nextStatus === "dispatched"');
  });

  it("governed finalization route registered in App", () => {
    const src = readSrc("App.tsx");
    expect(src).toContain('path="dispatch-finalization"');
    expect(src).toContain("DispatchFinalizationBoard");
  });

  it("supabase finalization store is only orders.update site in charter", () => {
    const src = readSrc("lib/dispatch-finalization/supabaseDispatchFinalizationStore.ts");
    expect(src).toContain(".update(patch)");
    const packing = readSrc("pages/admin/AdminPackingDispatch.tsx");
    expect(packing).not.toMatch(/orders["']\)\.update\(\{[^}]*status:\s*["']dispatched/);
  });
});
