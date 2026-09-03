import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Order Management surface authority guard (Point 34)", () => {
  it("Order Management cannot mutate order status directly or bypass governed dispatch finalization", () => {
    const page = source("src/pages/admin/OrderManagement.tsx");
    for (const forbidden of [
      '.from("orders").update',
      '.from("orders")\n        .update',
      '.from("orders")\n      .update',
      'payment_cleared',
      'final_invoice_url',
      'recordDeliveryProof',
      'closeOrderCommercially',
      'fileCommercialComplaint',
      'resolveCommercialComplaint',
    ]) {
      expect(page, `legacy/direct authority token must remain absent: ${forbidden}`).not.toContain(forbidden);
    }
    expect(page).toContain("Mark Dispatched is disabled here");
    expect(page).toContain("governed dispatch finalization");
  });

  it("Order Management delegates status transitions to governed order authority RPCs", () => {
    const page = source("src/pages/admin/OrderManagement.tsx");
    for (const governed of [
      "confirmPrepaidOrderAwaitingAdvance",
      "releaseOrderToInProduction",
      "releaseOrderToPackedReady",
      "clearOrderForDispatch",
      "isGovernedOrderActionAvailable",
      "governedOrderActionDisabledReason",
    ]) {
      expect(page, `governed authority call must remain present: ${governed}`).toContain(governed);
    }
  });

  it("confirmed orders target governed in_production release, not legacy manufacturing", () => {
    const page = source("src/pages/admin/OrderManagement.tsx");
    expect(page).toContain('status: "confirmed"');
    expect(page).toContain('next: "in_production"');
    expect(page).not.toMatch(/status:\s*"confirmed"[^}]*next:\s*"manufacturing"/);
  });

  it("governedOrderActions allows confirmed → in_production production release (Point 37)", () => {
    const actions = source("src/utils/governedOrderActions.ts");
    expect(actions).toContain('status === "confirmed" && next === "in_production"');
  });
});
