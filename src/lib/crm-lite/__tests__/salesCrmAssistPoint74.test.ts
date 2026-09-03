import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("Point 74 — CRM-lite sales assistance (Agent #8 workstation lock)", () => {
  const dashboard = source("pages/sales/SalesDashboard.tsx");
  const assistPanel = source("components/sales/crm-lite/SalesCrmAssistPanel.tsx");
  const workspace = source("components/sales/crm-lite/SalesCrmLiteWorkspace.tsx");
  const interactions = source("components/sales/ClientInteractionsTab.tsx");
  const evidence = readFileSync(resolve(process.cwd(), "docs/CRM_LITE_POINT_74_CLOSURE_EVIDENCE.md"), "utf8");

  it("documents Agent #8 ownership and HOLD behind #448", () => {
    expect(evidence).toContain("Agent #8");
    expect(evidence).toContain("HOLD");
    expect(evidence).toContain("#448");
    expect(evidence).toContain("Points 75–78");
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

  it("does not expand into commission payout mutation (P78 collateral boundary)", () => {
    expect(assistPanel).not.toContain("commission_payouts");
    expect(assistPanel).not.toContain("resolveCreditBinding");
  });
});
