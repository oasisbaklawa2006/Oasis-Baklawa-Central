import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const WEBHOOK_PATH = "supabase/functions/whatsapp-webhook/index.ts";

function source(): string {
  return readRepoSource(REPO_ROOT, WEBHOOK_PATH);
}

describe("WhatsApp webhook is capture-only ingress", () => {
  it("has no direct Click2API customer-outbound provider authority", () => {
    const webhook = source();
    expect(webhook).not.toContain("crm.click2api.in/api/v1/messages");
    expect(webhook).not.toContain("CLICK2API_API_KEY");
    expect(webhook).not.toContain("function sendReply");
    expect(webhook).not.toContain("async function sendReply");
  });

  it("cannot resurrect the retired Banyan buffer or legacy automatic acknowledgements", () => {
    const webhook = source();
    expect(webhook).not.toContain('.from("whatsapp_buffer")');
    expect(webhook).not.toContain("10-point artisan journey");
    expect(webhook).not.toContain("Oasis Operations has received your message");
    expect(webhook).not.toContain("acknowledged the ledger dispute");
  });

  it("preserves canonical durable intake and stitching", () => {
    const webhook = source();
    expect(webhook).toContain('.from("whatsapp_inbound_messages")');
    expect(webhook).toContain('capture_whatsapp_potential_order');
    expect(webhook).toContain('capture_whatsapp_commercial_fragment_for_potential');
    expect(webhook).toContain('.from("whatsapp_messages")');
    expect(webhook).toContain('whatsapp-message-stitcher');
    expect(webhook).toContain('duplicate_wamid');
  });

  it("treats image audio video and document messages as zero-loss evidence even without text", () => {
    const webhook = source();
    expect(webhook).toContain('new Set(["image", "document", "video", "audio"])');
    expect(webhook).toContain("message.audio");
    expect(webhook).toContain("payload?.video?.url");
    expect(webhook).toContain("payload?.audio?.url");
    expect(webhook).toContain("mediaId:");
    expect(webhook).toContain("hasMediaEvidence(fields)");
    expect(webhook).toContain("!fields.messageBody && !mediaEvidence");
  });

  it("does not regain direct live-order or legacy customer mutation authority", () => {
    const webhook = source();
    expect(webhook).not.toContain('.from("orders").insert');
    expect(webhook).not.toContain('.from("orders").update');
    expect(webhook).not.toContain('.from("shadow_clients")');
    expect(webhook).not.toContain('.from("client_interactions")');
  });
});
