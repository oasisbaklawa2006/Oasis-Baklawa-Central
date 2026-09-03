import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("CRM-lite Lane E closure — Points 74–78", () => {
  const dashboard = source("pages/sales/SalesDashboard.tsx");
  const workspace = source("components/sales/crm-lite/SalesCrmLiteWorkspace.tsx");
  const audit = readFileSync(resolve(process.cwd(), "docs/CRM_LITE_LANE_E_CLOSURE_AUDIT.md"), "utf8");

  it("documents the lane E point matrix and PR train", () => {
    expect(audit).toContain("Point evidence matrix");
    expect(audit).toContain("| **74** | CRM-lite sales assistance |");
    expect(audit).toContain("| **78** | Commission / feedback linkage |");
    expect(audit).toContain("cursor/crm-lite-lane-e-closure-1970");
  });

  it("P74 — mounts unified CRM-lite assist workspace on the sales console", () => {
    expect(dashboard).toContain("SalesCrmLiteWorkspace");
    expect(workspace).toContain("ClientInteractionsTab");
    expect(workspace).toContain('TabsTrigger value="assist"');
  });

  it("P75 — exposes repeat-contact queue and crm_tasks writes", () => {
    expect(workspace).toContain("Repeat-contact queue");
    expect(workspace).toContain('from("crm_tasks").insert');
    expect(workspace).toContain("Create repeat-contact task");
    expect(workspace).toContain('follow_up_date');
  });

  it("P76 — links governed credit requests and company pricing fields", () => {
    expect(workspace).toContain("CreditRequestModal");
    expect(workspace).toContain("resolveCreditBinding");
    expect(workspace).toContain("price_tier");
    expect(workspace).toContain("discount_percentage");
    expect(dashboard).toContain("price_tier");
  });

  it("P77 — surfaces first-line tickets via order to company linkage", () => {
    expect(workspace).toContain('from("support_tickets")');
    expect(workspace).toContain("order:orders(company_id, order_number)");
    expect(workspace).toContain("/admin/support");
  });

  it("P78 — surfaces commission-risk ticket feedback read-only", () => {
    expect(workspace).toContain("commission_blocked");
    expect(workspace).toContain("customer_rating");
    expect(workspace).toContain("Commission-risk tickets");
    expect(workspace).not.toContain('from("commission_payouts").insert');
  });
});
