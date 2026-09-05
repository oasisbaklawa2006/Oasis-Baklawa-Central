import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_PATH = resolve(process.cwd(), "src/pages/admin/AdminClients.tsx");

function readSource() {
  return readFileSync(SOURCE_PATH, "utf8");
}

function handlerBody(handlerName: string) {
  const source = readSource();
  const start = source.indexOf(`const ${handlerName} = async`);
  expect(start).toBeGreaterThan(-1);
  const nextHandler = source.indexOf("\n  const ", start + 1);
  return source.slice(start, nextHandler > start ? nextHandler : undefined);
}

describe("AdminClients KPI refresh after pipeline mutations", () => {
  it("uses the shared authoritative count query helper", () => {
    const source = readSource();
    expect(source).toContain('from "@/lib/client-governance/clientGovernanceCounts"');
    expect(source).toContain("fetchClientGovernanceCounts(supabase)");
  });

  it("refreshes list and summary counters after successful approval", () => {
    const body = handlerBody("handleApprove");
    expect(body).toContain("await refreshAfterPipelineMutation()");
    expect(body).not.toMatch(/fetchApps\(tab\)/);
  });

  it("refreshes list and summary counters after successful rejection", () => {
    const body = handlerBody("handleReject");
    expect(body).toContain("await refreshAfterPipelineMutation()");
    expect(body).not.toMatch(/fetchApps\(tab\)/);
  });

  it("refreshes list and summary counters after successful request-info", () => {
    const body = handlerBody("handleRequestInfo");
    expect(body).toContain("await refreshAfterPipelineMutation()");
    expect(body).not.toMatch(/fetchApps\(tab\)/);
  });

  it("does not refresh KPI counters when approval RPC fails", () => {
    const body = handlerBody("handleApprove");
    const catchBlock = body.slice(body.indexOf("} catch"));
    expect(catchBlock).not.toContain("refreshAfterPipelineMutation");
  });

  it("does not refresh KPI counters when rejection RPC fails", () => {
    const body = handlerBody("handleReject");
    const catchBlock = body.slice(body.indexOf("} catch"));
    expect(catchBlock).not.toContain("refreshAfterPipelineMutation");
  });

  it("does not refresh KPI counters when request-info update fails", () => {
    const body = handlerBody("handleRequestInfo");
    const failureBranch = body.slice(body.indexOf("} else {"));
    expect(failureBranch).toContain('toast.error("Failed to log request.")');
    expect(failureBranch).not.toContain("refreshAfterPipelineMutation");
  });
});
