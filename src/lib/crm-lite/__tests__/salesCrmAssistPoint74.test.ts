import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("Point 74 — CRM-lite sales assistance (governed Point62 writes)", () => {
  const dashboard = source("pages/sales/SalesDashboard.tsx");
  const interactions = source("components/sales/ClientInteractionsTab.tsx");

  it("routes interaction writes through governed Point62 capture boundary", () => {
    expect(interactions).toContain("crmActionCapture.captureManualAction");
    expect(interactions).toContain("crmActionCapture.captureWhatsAppManualLog");
    expect(interactions).not.toContain('from("client_interactions").insert');
    expect(dashboard).toContain("crmActionCapture.captureManualAction");
    expect(dashboard).toContain("crmActionCapture.captureWhatsAppManualLog");
    expect(dashboard).not.toContain('from("client_interactions").insert');
  });

  it("scopes assist timeline reads to the logged-in sales executive", () => {
    expect(interactions).toContain("scopeExecutiveId");
    expect(interactions).toContain('.eq("executive_id", scopeExecutiveId)');
  });
});
