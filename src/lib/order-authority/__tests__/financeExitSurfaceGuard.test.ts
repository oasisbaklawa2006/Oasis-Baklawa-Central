import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Finance Exit surface authority guard", () => {
  it("Accounts Release cannot recreate legacy dispatch or post-ticket CRM authority", () => {
    const page = source("src/pages/admin/AdminAccountsRelease.tsx");
    for (const forbidden of [
      '.from("dispatches")',
      '.from("dispatch_cartons")',
      'wallet_balance',
      'recordWalletEntry',
      'final_invoice_url',
      'URL.createObjectURL',
      'ewayThresholdForDestinationState',
      'Math.ceil(totalValue / 5000)',
      'closeOrderCommercially',
      'fileCommercialComplaint',
      'resolveCommercialComplaint',
      'recordDeliveryProof',
    ]) {
      expect(page, `out-of-scope/legacy authority token must remain absent: ${forbidden}`).not.toContain(forbidden);
    }
    for (const governed of [
      "getFinanceExitFacts",
      "receiveSubmittedB2bDpls",
      "issueFinalInvoice",
      "recordEwayEvidence",
      "decideFinanceDispatchClearance",
      "clearOrderForDispatch",
    ]) {
      expect(page, `governed Finance Exit call must remain present: ${governed}`).toContain(governed);
    }
    expect(page).toContain("Invoice date is Day 1");
  });

  it("the canonical security gate route delegates only to the governed B2B exit gate", () => {
    const route = source("src/pages/admin/AdminSecurityGate.tsx");
    expect(route).toContain('export { default } from "./AdminB2bSecurityGate"');
    for (const forbidden of [
      '.from("dispatch_cartons")',
      '.from("inward_material_advice")',
      '.from("audit_logs")',
      "payment_cleared",
      "final_invoice_url",
      "ewayThresholdForDestinationState",
    ]) expect(route).not.toContain(forbidden);
  });

  it("B2B gate records physical exit and dispatch proof but no delivery/complaint processing", () => {
    const page = source("src/pages/admin/AdminB2bSecurityGate.tsx");
    expect(page).toContain('.from("b2b_dispatch_cartons")');
    expect(page).toContain("releaseB2bCartonAtDispatchGate");
    expect(page).toContain('from("operational_scan_records")');
    expect(page).toContain("recordDispatchProof");
    expect(page).toContain("getFinanceExitFacts");
    expect(page).toContain("final invoice date");
    expect(page).toContain("never starts, restarts or extends");
    for (const forbidden of [
      '.from("dispatch_cartons")',
      'payment_cleared',
      'final_invoice_url',
      'ewayThresholdForDestinationState',
      '.from("dispatches")',
      'recordDeliveryProof',
      'fileCommercialComplaint',
      'resolveCommercialComplaint',
      'closeOrderCommercially',
    ]) expect(page).not.toContain(forbidden);
  });

  it("Finance DPL receipt client accepts no browser DPL snapshot, lines or carton IDs", () => {
    const client = source("src/lib/order-authority/financeExitAuthorityClient.ts");
    const start = client.indexOf("export async function receiveSubmittedB2bDpls");
    const end = client.indexOf("export async function issueFinalInvoice", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const receipt = client.slice(start, end);
    expect(receipt).toContain("receive_submitted_b2b_dispatch_dpls_v1");
    expect(receipt).not.toContain("p_dpl_snapshot");
    expect(receipt).not.toContain("p_carton_ids");
    expect(receipt).not.toContain("p_lines");
  });

  it("Finance Exit facts fail closed unless Core declares FINAL_INVOICE_DATE clock basis", () => {
    const client = source("src/lib/order-authority/financeExitAuthorityClient.ts");
    expect(client).toContain('complaintClockBasis !== "FINAL_INVOICE_DATE"');
    expect(client).toContain("not anchored to final invoice date");
  });
});
