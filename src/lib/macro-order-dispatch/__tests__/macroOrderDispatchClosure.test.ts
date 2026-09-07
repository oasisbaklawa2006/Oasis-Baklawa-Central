import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MACRO_AMENDMENT_SURFACE,
  MACRO_DISPATCH_MANAGER_HOME,
  MACRO_ORDER_DISPATCH_JOURNEY,
  MACRO_PHYSICAL_UAT_DEFERRED,
} from "@/lib/macro-order-dispatch/macroOrderDispatchJourney";
import { CENTRAL_ORDER_POOL_CANONICAL_ROUTE } from "@/lib/centralOrderPool/centralOrderPoolRouteCensus";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Central #554 Leap 7 macro order-to-gate closure", () => {
  it("declares the governed journey stages from order pool through security gate", () => {
    const keys = MACRO_ORDER_DISPATCH_JOURNEY.map((stage) => stage.key);
    expect(keys).toEqual([
      "order_pool",
      "finance_release",
      "production",
      "assembly",
      "ready_goods",
      "three_pgs",
      "packing_dpl",
      "finance_exit",
      "security_gate",
    ]);
  });

  it("mounts the canonical order pool hub", () => {
    const app = source("src/App.tsx");
    expect(CENTRAL_ORDER_POOL_CANONICAL_ROUTE).toBe("/admin/central-pool");
    expect(app).toMatch(/path="central-pool"[\s\S]*?<CentralOrderPoolCommandCentre\s*\/>/);
  });

  it("absorbs Point71–92 authority modules without legacy central-pool redirect", () => {
    const app = source("src/App.tsx");
    expect(app).not.toContain('<Route path="central-pool" element={<Navigate to="/admin/operator-inbox"');
    expect(source("src/lib/order-priority-owner-sla/index.ts")).toContain("orderPriorityOwnerSlaClient");
    expect(source("src/lib/order-authority/orderAmendmentAuthorityClient.ts")).toContain("requestOrderAmendment");
    expect(source("src/lib/order-partial-fulfilment/index.ts")).toContain("partialFulfilmentAuthorityClient");
    expect(source("src/lib/exception-governance/exceptionShadowWriteGuard.ts")).toContain("assertNotShadowWrite");
    expect(source("src/lib/packing-carton-dpl/index.ts")).toContain("packingCartonDplContracts");
  });

  it("wires governed amendment panel into order trace", () => {
    expect(source("src/components/admin/OrderTraceSheet.tsx")).toContain("OrderAmendmentActionsPanel");
  });

  it("completes customer dispatch communication at the security gate", () => {
    const gate = source("src/pages/admin/AdminB2bSecurityGate.tsx");
    expect(gate).toContain("recordGovernedCustomerDispatchCommunication");
    expect(gate).toContain("assessDispatchCustomerCommunicationEligibility");
    expect(gate).not.toContain("must still be completed");
  });

  it("keeps Dispatch Manager least privilege on dispatch home", () => {
    expect(MACRO_DISPATCH_MANAGER_HOME).toBe("/admin/dispatch-mgmt");
    const roleAccess = source("src/lib/appverse/roleAccess.ts");
    expect(roleAccess).toMatch(/DISPATCH_MANAGER:\s*\[[^\]]*"dispatch"/);
  });

  it("does not claim physical scanner/TV/gate PASS in software certification", () => {
    const mission = source(".appverse/MACRO_ORDER_DISPATCH_MISSION.md");
    expect(mission).toContain("Do not claim physical scanner/TV/gate PASS");
    expect(MACRO_PHYSICAL_UAT_DEFERRED).toContain("physical_scanner_pass");
    expect(MACRO_PHYSICAL_UAT_DEFERRED).toContain("physical_tv_pass");
    expect(MACRO_PHYSICAL_UAT_DEFERRED).toContain("physical_gate_pass");
  });

  it("exposes amendment/cancel/substitute on the governed order management surface", () => {
    expect(MACRO_AMENDMENT_SURFACE).toBe("/admin/order-management");
    expect(source("src/components/admin/OrderAmendmentActionsPanel.tsx")).toContain("requestOrderCancellation");
  });

  for (const stage of MACRO_ORDER_DISPATCH_JOURNEY) {
    it(`registers ${stage.key} route ${stage.route}`, () => {
      const app = source("src/App.tsx");
      const segment = stage.route.split("/").filter(Boolean).pop() ?? stage.route;
      expect(app).toContain(segment);
    });
  }
});
