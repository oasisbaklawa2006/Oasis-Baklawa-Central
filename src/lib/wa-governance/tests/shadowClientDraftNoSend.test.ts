import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/warroom/ShadowClientSection.tsx"),
  "utf8",
);

describe("WA-100 Shadow Client approval and draft handoff", () => {
  it("queues the selected company and checks the returned governance application ID", () => {
    expect(source).toContain('"queue_whatsapp_shadow_client_for_approval_v1"');
    expect(source).toContain("p_company_id: editingCompany.id");
    expect(source).toContain("if (error || !applicationId)");
    expect(source).toContain("Client queued for approval in Client Governance.");
  });

  it("hands verified conversations to Operator Inbox without calling the legacy writer or sender", () => {
    expect(source).toContain('to="/admin/operator-inbox"');
    expect(source).toContain("confirm the customer and order lines");
    expect(source).not.toContain("admin-create-draft");
    expect(source).not.toContain("send_whatsapp_to");
    expect(source).not.toContain("whatsapp_message");
    expect(source).not.toContain('supabase.functions.invoke("send-whatsapp"');
  });

  it("reports client approval independently from draft creation and WhatsApp", () => {
    expect(source).toContain("No sales-order draft was created. No WhatsApp message was sent.");
    expect(source).toContain("If only debug history is available");
  });
});
