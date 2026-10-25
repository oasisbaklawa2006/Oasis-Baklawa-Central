import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

/**
 * WhatsApp UI/UX simplification (Central #639 checkpoint contract): the render layer is
 * decluttered through progressive disclosure only. Every handler, permission gate and
 * governed action must stay reachable.
 */
describe("operator inbox simplification keeps every capability reachable", () => {
  const inbox = () => readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);

  it("AI suggestions are collapsed until used, and auto-open once there is a result or an error", () => {
    const src = inbox();
    const marker = src.indexOf("data-operator-inbox-edge-suggestions");
    expect(marker).toBeGreaterThan(-1);
    const block = src.slice(marker, src.indexOf("</details>", marker + 1200));
    expect(block).toContain("open={Boolean(intentResult || routeResult || suggestionsError)}");
    expect(block).toContain("handleClassifyIntent");
    expect(block).toContain("handleSuggestRoute");
    expect(block).toContain("suggestionsError");
  });

  it("suggestion metadata stays available behind a Technical details disclosure", () => {
    const src = inbox();
    expect(src.match(/Technical details/g)?.length).toBe(2);
    expect(src).toContain("JSON.stringify(intentResult.metadata ?? {})");
    expect(src).toContain("JSON.stringify(routeResult.metadata ?? {})");
  });

  it("message direction, provider and sequence remain available per message", () => {
    const src = inbox();
    expect(src).toContain('<span className="sr-only">{msg.direction}</span>');
    expect(src).toContain("msg.provider ? ` · ${msg.provider}` : \"\"");
    expect(src).toContain("msg.packet_sequence != null ? ` · #${msg.packet_sequence}` : \"\"");
  });

  it("contact header keeps phone and WA id and explains the data source on hover", () => {
    const src = inbox();
    expect(src).toContain("WhatsApp: {selectedPacket.phone_number}");
    expect(src).toContain("WA id: {selectedPacket.wa_contact_id}");
    expect(src).toContain("whatsapp_contacts only");
  });

  it("governed reply gating is untouched", () => {
    const src = inbox();
    expect(src).toContain('whatsappAuthority.has("wa.reply.send")');
    expect(src).toContain("Governed reply disabled: {governedContextError}");
    expect(src).toContain("void handleSendReply()");
  });
});
