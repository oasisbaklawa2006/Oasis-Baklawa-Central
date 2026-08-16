import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";
import {
  packetStitchedPlainText,
  inferLocalIntentFromText,
  operatorInboxPacketPreviewSummary,
} from "@/components/whatsapp/operatorInboxUtils";
import type { OperatorInboxPacket, Message } from "@/components/whatsapp/operatorInboxTypes";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

function buildUnknownSenderPacket(): OperatorInboxPacket {
  const messages: Message[] = [
    {
      id: "u1",
      content: "Can I get a tray of baklawa with pistachio for a birthday",
      message_type: "text",
      direction: "inbound",
      created_at: new Date().toISOString(),
      packet_sequence: 1,
      provider_message_id: "up1",
    },
  ];
  return {
    id: "packet-unknown-1",
    contact_id: "contact-unknown",
    fragment_count: 1,
    status: "open",
    first_message_at: messages[0]!.created_at!,
    last_message_at: messages[0]!.created_at!,
    stitched_content: { text: messages.map((m) => m.content).join("\n") },
    messages,
    customer_name: "Unknown",
    phone_number: "0000000000",
    wa_contact_id: null,
  };
}

/**
 * WHATSAPP_OPERATOR_WORKSPACE_CLOSURE.md requires discovery to work even when
 * the operator does not already know the sender's name/phone: search must
 * also match message text/preview and decoded product/order hints.
 */
describe("operator inbox unknown-sender discovery", () => {
  it("WhatsAppInbox builds a packet-wide search index from stitched + message text and decoded intent, not just sender identity", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("const packetSearchIndex = useMemo(");
    expect(inbox).toContain("inferLocalIntentFromText(combinedText).label");
    expect(inbox).toContain("map.set(p.id, `${combinedText}\\n${decodedHint}`.toLowerCase());");
  });

  it("filteredPackets matches on the search index in addition to customer_name/phone_number/preview", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const filteredPacketsIndex = inbox.indexOf("const filteredPackets = useMemo(");
    expect(filteredPacketsIndex).toBeGreaterThan(-1);
    const filteredPacketsBlock = inbox.slice(filteredPacketsIndex, inbox.indexOf("}, [packets, filterQuery"));
    expect(filteredPacketsBlock).toContain("packetSearchIndex.get(p.id)");
    expect(filteredPacketsBlock).toContain("fullText.includes(q)");
  });

  it("a packet with 'Unknown' sender and a non-matching phone is still discoverable by message content", () => {
    const packet = buildUnknownSenderPacket();
    const stitched = packetStitchedPlainText(packet.stitched_content);
    const messagesText = (packet.messages ?? []).map((m) => m.content ?? "").join(" ");
    const combinedText = `${stitched}\n${messagesText}`;
    const decodedHint = inferLocalIntentFromText(combinedText).label;
    const searchIndexEntry = `${combinedText}\n${decodedHint}`.toLowerCase();

    const query = "pistachio";
    expect(packet.customer_name?.toLowerCase().includes(query)).toBe(false);
    expect(packet.phone_number?.toLowerCase().includes(query)).toBe(false);
    expect(operatorInboxPacketPreviewSummary(packet).toLowerCase().includes(query) || searchIndexEntry.includes(query)).toBe(true);
  });

  it("search input placeholder/aria-label communicate broadened discovery beyond name/phone", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toMatch(/Search name, phone, message text, product/);
  });
});
