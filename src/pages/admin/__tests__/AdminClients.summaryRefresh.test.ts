import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regression coverage for Admin Clients KPI staleness (P1 UAT): after
// approve/reject mutations the pending tab list refreshed but summary KPI
// cards (Pending Review / Recently Approved) stayed at mount-time values.

describe("AdminClients summary KPI refresh contract", () => {
  const source = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminClients.tsx"), "utf8");

  it("uses the authoritative client governance count module", () => {
    expect(source).toContain('from "@/lib/client-governance/clientGovernanceCounts"');
    expect(source).toContain("fetchClientGovernanceCounts(supabase)");
    expect(source).toContain("refreshStableCounts");
    expect(source).toContain("refreshAfterPipelineMutation");
  });

  it("refreshes summary counters after successful approve and reject mutations", () => {
    const approveBlock = source.slice(source.indexOf("const handleApprove"), source.indexOf("const handleReject"));
    const rejectBlock = source.slice(source.indexOf("const handleReject"), source.indexOf("const handleRequestInfo"));

    expect(approveBlock).toContain("await refreshAfterPipelineMutation()");
    expect(rejectBlock).toContain("await refreshAfterPipelineMutation()");
  });

  it("refreshes summary counters after successful request-info mutation", () => {
    const requestInfoBlock = source.slice(
      source.indexOf("const handleRequestInfo"),
      source.indexOf("const getInviteForApp"),
    );

    expect(requestInfoBlock).toContain("await refreshAfterPipelineMutation()");
  });

  it("does not refresh summary counters on mutation failure paths", () => {
    const approveCatch = source.slice(source.indexOf("[AdminClients] Approval failed"), source.indexOf("const handleReject"));
    const rejectCatch = source.slice(source.indexOf("[AdminClients] Rejection failed"), source.indexOf("const handleRequestInfo"));
    const requestInfoFailure = source.slice(source.indexOf('toast.error("Failed to log request.")'), source.indexOf("const getInviteForApp"));

    expect(approveCatch).not.toContain("refreshAfterPipelineMutation");
    expect(approveCatch).not.toContain("refreshStableCounts");
    expect(rejectCatch).not.toContain("refreshAfterPipelineMutation");
    expect(rejectCatch).not.toContain("refreshStableCounts");
    expect(requestInfoFailure).not.toContain("refreshAfterPipelineMutation");
    expect(requestInfoFailure).not.toContain("refreshStableCounts");
  });
});
