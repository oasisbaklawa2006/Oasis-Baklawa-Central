import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

/**
 * WHATSAPP_OPERATOR_WORKSPACE_CLOSURE.md "Progressive disclosure": observability,
 * confidence/provenance internals, governance slot explanations and raw
 * audit/diagnostic panels must default collapsed so they never block the
 * primary read/reply workflow, while remaining reachable for supervisors/audit.
 */
describe("operator inbox progressive disclosure defaults", () => {
  it("observability strip and local AI preview default OFF", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("const [showObservabilityStrip, setShowObservabilityStrip] = useState(false);");
    expect(inbox).toContain("const [showAiPreviewPanel, setShowAiPreviewPanel] = useState(false);");
  });

  it("the WA-1/WA-3/WA-4 governance queues strip is collapsed by default (no `open` attribute)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const detailsIndex = inbox.indexOf("Governance queues (WA");
    expect(detailsIndex).toBeGreaterThan(-1);
    const openingTag = inbox.slice(inbox.lastIndexOf("<details", detailsIndex), detailsIndex);
    expect(openingTag).not.toMatch(/\bopen\b/);
  });

  it("the confidence & provenance details panel in Order Intelligence is collapsed by default", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const marker = inbox.indexOf("data-operator-inbox-confidence-provenance-details");
    expect(marker).toBeGreaterThan(-1);
    const openingTag = inbox.slice(inbox.lastIndexOf("<details", marker), marker);
    expect(openingTag).not.toMatch(/\bopen\b/);
  });

  it("the observability/audit/diagnostics details panel in Order Intelligence is collapsed by default", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const marker = inbox.indexOf("Observability, audit &amp; diagnostics");
    expect(marker).toBeGreaterThan(-1);
    const openingTag = inbox.slice(inbox.lastIndexOf("<details", marker), marker);
    expect(openingTag).not.toMatch(/\bopen\b/);
  });

  it("collapsed diagnostics content (operational context, failed messages, activity summary, explanation cards) lives inside the diagnostics details, not the primary draft panel", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const diagnosticsIndex = inbox.indexOf("Observability, audit &amp; diagnostics");
    const diagnosticsBlockEnd = inbox.indexOf("</details>", diagnosticsIndex);
    const diagnosticsBlock = inbox.slice(diagnosticsIndex, diagnosticsBlockEnd);
    expect(diagnosticsBlock).toContain("OperatorInboxOperationalContextPanel");
    expect(diagnosticsBlock).toContain("OperatorInboxFailedMessagesReadOnlyPanel");
    expect(diagnosticsBlock).toContain("OperatorInboxCustomerActivitySummary");
    expect(diagnosticsBlock).toContain("OperatorInboxLocalExplanationCards");
  });

  it("Order Intelligence aside can be re-expanded via an explicit operator action (progressive disclosure remains reachable)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("Show Order Intelligence");
    expect(inbox).toContain("setInsightsAsideUserCollapsed(false);");
  });
});
