import { describe, expect, it } from "vitest";
// Static ?raw imports: no runtime filesystem/path construction (Codacy File Access rule).
import webhook from "../../../../supabase/functions/whatsapp-webhook/index.ts?raw";
import suggested from "../../../components/warroom/SuggestedOrdersTab.tsx?raw";
import raw from "../../../components/warroom/RawIntelligenceTab.tsx?raw";
import inbox from "../../../pages/OperatorInbox.tsx?raw";
import handoff from "../../../components/whatsapp/OperatorInboxSourceHandoff.tsx?raw";

describe("WA-3 executable ambiguity guards", () => {
  it("keeps quantity interpretation out of the capture-only webhook", () => {
    expect(webhook).not.toContain("function parseQuantity");
    expect(webhook).not.toContain("aiParseOrder");
    expect(webhook).not.toContain("default to 1");
    expect(webhook).not.toMatch(/quantity\s*:\s*1\b/);
  });

  it("capture-only webhook cannot create or promote a direct order draft", () => {
    expect(webhook).not.toContain("orderItems");
    expect(webhook).not.toContain("hasIncompleteOrderEvidence");
    expect(webhook).not.toMatch(/\.from\(["']orders["']\)/);
    expect(webhook).not.toMatch(/\.from\(["']sales_order_drafts["']\)/);
    expect(webhook).not.toContain("admin-create-draft");
  });

  it.each([
    ["Suggested Orders", suggested],
    ["Raw Intelligence", raw],
  ])("does not leave dead links or create drafts in retired %s", (_screen, source) => {
    expect(source).not.toContain('to="/admin/operator-inbox"');
    expect(source).not.toMatch(/admin-create-draft|createSalesOrderDraft|create_sales_order_draft_atomic/);
    expect(source).not.toMatch(/quantity\s*:\s*[^,\n]*\?\?\s*1\b/);
  });

  it("mounts read-only, packet-specific lookup in the live Operator Inbox", () => {
    expect(inbox).toContain("<OperatorInboxSourceHandoff />");
    expect(inbox).toContain('wa.has("wa.intake.read") && wa.has("wa.intake.triage")');
    expect(handoff).toContain('eq("provider_message_id", providerId)');
    expect(handoff).toContain('in("contact_id", [...byId.keys()])');
    expect(handoff).toContain('/admin/operator-inbox?packet=');
    expect(handoff).not.toMatch(/sendWhatsAppMessage|admin-create-draft|\.insert\(/);
  });

  it("keeps accepted/unknown clarification sends blocked across tab remounts", () => {
    // Module-scoped set survives unmount (Operator Inbox round trip); component state alone does not.
    expect(suggested).toMatch(/^const sessionBlockedClarifications = new Set<string>\(\);/m);
    expect(suggested).toContain("useState<Set<string>>(\n    () => new Set(sessionBlockedClarifications),");
    expect(suggested).not.toContain("new Set(previous).add(clarifyTarget.id)");
  });
});
