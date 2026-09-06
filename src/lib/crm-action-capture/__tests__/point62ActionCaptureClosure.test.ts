import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("Point 62 — governed CRM action capture closure", () => {
  const boundary = source("lib/crm-action-capture/index.ts");
  const interactions = source("components/sales/ClientInteractionsTab.tsx");
  const dashboard = source("pages/sales/SalesDashboard.tsx");
  const evidence = readFileSync(
    resolve(process.cwd(), "docs/evidence/point62/CRM_ACTION_CAPTURE_CENSUS.md"),
    "utf8",
  );

  it("documents Point62 ancestry from Point61 #507", () => {
    expect(evidence).toContain("POINT62");
    expect(evidence).toContain("0892c9b2");
    expect(evidence).toContain("Point61");
  });

  it("exposes a single Central action-capture module", () => {
    const client = source("lib/crm-action-capture/crmActionCaptureClient.ts");
    const channels = source("lib/crm-action-capture/crmActionCaptureChannels.ts");
    expect(boundary).toContain("crmActionCaptureClient");
    expect(boundary).toContain("crmActionCaptureChannels");
    expect(client).toContain("captureCrmManualAction");
    expect(channels).toContain("captureEmailIntent");
    expect(channels).toContain("captureWhatsAppProviderSend");
  });

  it("routes sales write surfaces through the governed boundary", () => {
    expect(interactions).toContain("captureCrmManualAction");
    expect(interactions).not.toContain('from("client_interactions").insert');
    expect(dashboard).toContain("captureCrmManualAction");
    expect(dashboard).not.toContain('from("client_interactions").insert');
  });

  it("separates Point62 capture from Point63 tasks and Point61 read adaptor", () => {
    expect(evidence).toContain("Point63");
    expect(evidence).toContain("Point61");
    expect(evidence).not.toContain("crm_tasks mutation boundary");
  });
});
