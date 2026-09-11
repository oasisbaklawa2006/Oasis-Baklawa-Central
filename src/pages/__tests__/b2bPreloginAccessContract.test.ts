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
    expect(block).toContain("p_trade_declaration: true");
    expect(block).toContain("p_data_consent: true");
  });

  it("types the deployed v2 Core functions in Central", () => {
    expect(typeSource).toContain("submit_b2b_access_request_v2:");
    expect(typeSource).toContain("approve_b2b_access_request_v2:");
  });

  it("approves pending requests through the v2 pre-login lifecycle authority", () => {
    expect(adminClientsSource).toContain('supabase.rpc("approve_b2b_access_request_v2"');
    expect(adminClientsSource).not.toContain('supabase.rpc("approve_b2b_trade_application_v1"');
  });
});
