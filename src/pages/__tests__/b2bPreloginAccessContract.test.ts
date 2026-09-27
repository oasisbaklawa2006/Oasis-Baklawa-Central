import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");
const clientSource = readFileSync("src/lib/customerApp/customerAppClient.ts", "utf8");
const typeSource = readFileSync("src/integrations/supabase/database.types.ts", "utf8");
const adminClientsSource = readFileSync("src/pages/admin/AdminClients.tsx", "utf8");

describe("B2B pre-login access contract", () => {
  it("keeps /buyer/access-request public while leaving the form on a named route", () => {
    expect(appSource).toContain('<Route path="/buyer/access-request" element={<BuyerAccessRequest />} />');
    expect(appSource).not.toContain('<Route path="/buyer/access-request" element={<ProtectedRoute>');
  });

  it("submits through Core v2 governed pre-login RPC", () => {
    const start = clientSource.indexOf("  submitApplication: (input: {");
    const end = clientSource.indexOf("  submitTicket:", start);
    const block = clientSource.slice(start, end);
    expect(block).toContain('rpc("submit_b2b_access_request_v2"');
    expect(block).not.toContain("submit_b2b_trade_application_v1");
    expect(block).toContain("p_trade_declaration: input.tradeDeclaration");
    expect(block).toContain("p_data_consent: input.dataConsent");
    expect(block).toContain("tradeDeclaration: boolean");
    expect(block).toContain("dataConsent: boolean");
  });

  it("types the deployed v2 Core functions in Central", () => {
    expect(typeSource).toContain("submit_b2b_access_request_v2:");
    expect(typeSource).toContain("approve_b2b_access_request_v2:");
  });

  it("approves pending requests through the v2 pre-login lifecycle authority", () => {
    expect(adminClientsSource).toContain('supabase.rpc("approve_b2b_access_request_v2"');
    expect(adminClientsSource).not.toContain('supabase.rpc("approve_b2b_trade_application_v1"');
  });

  it("requires explicit applicant declaration and consent in the public form", () => {
    const buyerSource = readFileSync("src/pages/customer/BuyerApp.tsx", "utf8");
    expect(buyerSource).toContain('name="tradeDeclaration"');
    expect(buyerSource).toContain('name="dataConsent"');
    expect(buyerSource).toContain("checked={tradeDeclaration}");
    expect(buyerSource).toContain("checked={dataConsent}");
    expect(buyerSource).toContain("if (!tradeDeclaration || !dataConsent)");
  });

});
