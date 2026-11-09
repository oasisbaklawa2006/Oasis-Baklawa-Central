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
      "loadGovernedFinanceExitProjection",
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

  it("Accounts Release binds final-payment PI authority before final invoice issuance", () => {
    const page = source("src/pages/admin/AdminAccountsRelease.tsx");
    expect(page).toContain("loadGovernedFinanceExitProjection");
    expect(page).toContain("issueFinalPaymentPiRevision");
    expect(page).toContain("PI requests final payment");
    expect(page).toContain("finalPaymentPi.settled !== true");
    expect(page).toContain("isGovernedHttpsPaymentLink");
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
    expect(page).toContain("recordB2bDispatchGateScan");
    expect(page).toContain("scan.scanId");
    expect(page).not.toContain('.from("operational_scan_records")');
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

  it("B2B gate obtains authoritative immutable evidence from Core before release", () => {
    const page = source("src/pages/admin/AdminB2bSecurityGate.tsx");
    const client = source("src/lib/order-authority/gateExitAuthorityClient.ts");
    const scanStart = page.indexOf("await recordB2bDispatchGateScan(");
    const releaseStart = page.indexOf("await releaseB2bCartonAtDispatchGate(");
    expect(scanStart).toBeGreaterThan(-1);
    expect(releaseStart).toBeGreaterThan(scanStart);
    expect(page).toContain('.eq("carton_code", barcode)');
    expect(page).toContain('.ilike("carton_code", escapeGateBarcodeIlikeLiteral(barcode))');
    expect(page).toContain("caseInsensitiveCartons?.length === 1");
    expect(page).toContain("caseInsensitiveCartons[0].carton_code.toLowerCase() === barcode.toLowerCase()");
    expect(page).toContain("gateScanCorrelationId(carton.id, barcode.toLowerCase())");
    expect(page).toContain("scan.scanId");
    expect(page).not.toContain('.from("operational_scan_records")');
    expect(page).not.toContain("GATE_SCAN_POST_RELEASE_STATUS");
    expect(page).not.toContain("GATE_SCAN_RELEASE_DENIED_STATUS");
    expect(client).toContain('supabase.rpc("record_b2b_dispatch_gate_scan_v1"');
    expect(client).not.toContain('.from("operational_scan_records")');
    expect(page).toContain("b2b_dispatch_gate_decisions");
  });

  it("Point38 synthetic Gate certification records governed evidence only after carton readiness", () => {
    const script = source("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
    const ready = script.indexOf('"mark_b2b_dispatch_carton_ready_to_load_v1"');
    const scan = script.indexOf('await gateRole.client.rpc("record_b2b_dispatch_gate_scan_v1"');
    const release = script.indexOf('await gateRole.client.rpc("release_b2b_dispatch_carton_at_gate_v1"');
    expect(ready).toBeGreaterThan(-1);
    expect(scan).toBeGreaterThan(ready);
    expect(release).toBeGreaterThan(scan);
    expect(script).toContain("p_idempotency_key: gateScanCorrelation");
    expect(script).toContain("gateScan?.carton_id !== cartonId");
    expect(script).toContain('process.env.POINT100_CORE_VERIFIED_SHA === "645899439fe0a84806238b9114649eb2c3785a75"');
    expect(script).toContain('process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED === "true"');
    expect(script).toContain("POINT100_PRE507_LEGACY_FIXTURE_ONLY");
    const governedBlock = script.slice(script.indexOf("  } else {\n    // Replays"), script.indexOf("  // Finance stays independent"));
    expect(governedBlock).toContain('gateRole.client.rpc("record_b2b_dispatch_gate_scan_v1"');
    expect(governedBlock).not.toContain('.from("operational_scan_records")');
    expect(governedBlock).not.toContain('.update({ verification_status: "verified" })');
  });

  it("Point100 Playwright dispatch tail enforces carton-ready and governed Gate scan after Core #507", () => {
    const tail = source("tests/point100/canonicalDispatchTail.ts");
    const ready = tail.indexOf('dispatchReady.rpc("mark_b2b_dispatch_carton_ready_to_load_v1"');
    const governed = tail.indexOf('gate.rpc("record_b2b_dispatch_gate_scan_v1"');
    const release = tail.indexOf('gate.rpc("release_b2b_dispatch_carton_at_gate_v1"');
    expect(ready).toBeGreaterThan(-1);
    expect(governed).toBeGreaterThan(ready);
    expect(release).toBeGreaterThan(governed);
    expect(tail).toContain('process.env.POINT100_CORE_VERIFIED_SHA === "645899439fe0a84806238b9114649eb2c3785a75"');
    expect(tail).toContain('process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED === "true"');
    expect(tail).toContain("POINT100_PRE507_LEGACY_FIXTURE_ONLY");
    const newCorePath = tail.slice(tail.indexOf('  } else {\n    const { data: authoritativeScan'), release);
    expect(newCorePath).toContain('gate.rpc("record_b2b_dispatch_gate_scan_v1"');
    expect(newCorePath).not.toContain('.from("operational_scan_records")');
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
