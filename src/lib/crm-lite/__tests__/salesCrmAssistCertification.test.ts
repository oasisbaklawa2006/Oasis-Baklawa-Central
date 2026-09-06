import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("CRM-lite sales assistance certification (non-numbered)", () => {
  const dashboard = source("pages/sales/SalesDashboard.tsx");
  const assistPanel = source("components/sales/crm-lite/SalesCrmAssistPanel.tsx");
  const workspace = source("components/sales/crm-lite/SalesCrmLiteWorkspace.tsx");
  const interactions = source("components/sales/ClientInteractionsTab.tsx");
  const evidence = readFileSync(
    resolve(process.cwd(), "docs/CRM_LITE_SALES_ASSISTANCE_CERTIFICATION_EVIDENCE.md"),
    "utf8",
  );

  it("documents #459 numbering correction and does not claim original Point 74", () => {
    expect(evidence).toContain("#459");
    expect(evidence).toContain("priority / owner / SLA");
    expect(evidence).toContain("does not** strike, merge, or close original Point 74");
    expect(evidence).toContain("TEST_SALES_EMAIL");
  });

  it("mounts a dedicated assist panel on the sales console", () => {
    expect(assistPanel).toContain('data-point="74"');
    expect(assistPanel).toContain("CRM-lite sales assistance");
    expect(assistPanel).toContain("ClientInteractionsTab");
    expect(workspace).toContain("SalesCrmAssistPanel");
    expect(workspace).toContain('TabsContent value="assist"');
  });

  it("writes interactions through governed client_interactions contract", () => {
    expect(interactions).toContain('from("client_interactions").insert');
    expect(dashboard).toContain('from("client_interactions").insert');
    expect(dashboard).toContain("account_manager_id");
  });

  it("links roster clients into the assist workspace", () => {
    expect(dashboard).toContain("Open assist");
    expect(dashboard).toContain("assistFocusCompanyId");
    expect(dashboard).toContain("sales-crm-lite-workspace");
    expect(interactions).toContain("initialFilterCompanyId");
  });

  it("scopes assist timeline reads to the logged-in sales executive", () => {
    expect(assistPanel).toContain("scopeExecutiveId={userId}");
    expect(interactions).toContain("scopeExecutiveId");
    expect(interactions).toContain('.eq("executive_id", scopeExecutiveId)');
  });

  it("activates the Assist tab when roster Open assist is used", () => {
    expect(workspace).toContain("setActiveTab(\"assist\")");
    expect(workspace).toContain("assistFocusCompanyId");
    expect(dashboard).toContain("Open assist");
    expect(dashboard).toContain("setLogCompany(c.id)");
  });

  it("does not expand into commission payout mutation", () => {
    expect(assistPanel).not.toContain("commission_payouts");
    expect(assistPanel).not.toContain("resolveCreditBinding");
  });
});
