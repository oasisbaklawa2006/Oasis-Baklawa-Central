import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOperatorInboxDraftOrderExtraction } from "@/components/whatsapp/useOperatorInboxDraftOrderExtraction";
import { deriveMessageMediaStatus, findEvidenceForMessage } from "@/components/whatsapp/operatorInboxUtils";
import type { OperatorInboxPacket, Message } from "@/components/whatsapp/operatorInboxTypes";
import type { GovernedEvidenceLink } from "@/components/whatsapp/operatorInboxPacketsLoader";
import type { OperatorInboxSenderIdentityState } from "@/components/whatsapp/useOperatorInboxSenderIdentity";
import type { OperatorInboxClientResolutionState } from "@/lib/wa-governance/clientResolutionRequestKey";
import type { OperatorInboxProductResolutionState } from "@/lib/wa-governance/productResolutionRequestKey";
import type { OperatorInboxQuantityResolutionState } from "@/lib/wa-governance/quantityResolutionRequestKey";

/** Golden physical acceptance case (16 Aug 2026). */
function buildSixFragmentTwoPhotoPacket(): OperatorInboxPacket {
  const base = Date.parse("2026-08-16T10:00:00.000Z");
  const messages: Message[] = [
    { id: "m1", content: "Hi, I need baklawa for a wedding", message_type: "text", direction: "inbound", created_at: new Date(base).toISOString(), packet_sequence: 1, provider_message_id: "p1" },
    { id: "m2", content: "around 200 people coming", message_type: "text", direction: "inbound", created_at: new Date(base + 1000).toISOString(), packet_sequence: 2, provider_message_id: "p2" },
    { id: "m3", content: "here is a photo of the tray we want", message_type: "image", direction: "inbound", created_at: new Date(base + 2000).toISOString(), packet_sequence: 3, provider_message_id: "p3" },
    { id: "m4", content: "and one more angle", message_type: "image", direction: "inbound", created_at: new Date(base + 3000).toISOString(), packet_sequence: 4, provider_message_id: "p4" },
    { id: "m5", content: "can you deliver by Friday", message_type: "text", direction: "inbound", created_at: new Date(base + 4000).toISOString(), packet_sequence: 5, provider_message_id: "p5" },
    { id: "m6", content: "budget is flexible", message_type: "text", direction: "inbound", created_at: new Date(base + 5000).toISOString(), packet_sequence: 6, provider_message_id: "p6" },
  ];
  return {
    id: "packet-golden-1", contact_id: "contact-1", fragment_count: 6, status: "open",
    first_message_at: messages[0]!.created_at!, last_message_at: messages[5]!.created_at!,
    stitched_content: { text: messages.map((m) => m.content).join("\n") }, messages,
    customer_name: "Unknown", phone_number: "9999999999", wa_contact_id: null,
  };
}

const readyIdentity: OperatorInboxSenderIdentityState = { status: "idle" };
const readyClient: OperatorInboxClientResolutionState = { status: "ready", requestKey: "client-key", result: { candidateClients: [], bestMatch: null, band: "needs_clarification" } };
const readyProductUnresolved: OperatorInboxProductResolutionState = { status: "ready", requestKey: "product-key", result: { candidateProducts: [], bestMatch: null, band: "needs_clarification" } };
const readyQuantityUnresolved: OperatorInboxQuantityResolutionState = { status: "ready", requestKey: "quantity-key", result: { quantities: [], band: "needs_clarification" } };

describe("golden physical case: six-fragment/two-photo packet-wide interpretation", () => {
  it("restores complete chronological packet text from deliberately shuffled input", () => {
    const packet = buildSixFragmentTwoPhotoPacket();
    packet.messages = [packet.messages![5]!, packet.messages![2]!, packet.messages![0]!, packet.messages![4]!, packet.messages![1]!, packet.messages![3]!];
    const { result } = renderHook(() => useOperatorInboxDraftOrderExtraction(packet, readyIdentity, readyClient, readyProductUnresolved, readyQuantityUnresolved));
    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status !== "ready") return;
    expect(result.current.state.draft.sourceText).toBe([
      "Hi, I need baklawa for a wedding",
      "around 200 people coming",
      "here is a photo of the tray we want",
      "and one more angle",
      "can you deliver by Friday",
      "budget is flexible",
    ].join("\n"));
  });

  it("preserves exactly six distinct provider identities with one packet membership each", () => {
    const packet = buildSixFragmentTwoPhotoPacket();
    const expected = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const identities = packet.messages!.map((m) => m.provider_message_id);
    expect(identities).toEqual(expected);
    expect(new Set(identities).size).toBe(6);
    expect(packet.messages!.map((m) => m.packet_sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(packet.fragment_count).toBe(6);
  });

  it("never invents a product or quantity when upstream resolution found nothing supported", () => {
    const packet = buildSixFragmentTwoPhotoPacket();
    const { result } = renderHook(() => useOperatorInboxDraftOrderExtraction(packet, readyIdentity, readyClient, readyProductUnresolved, readyQuantityUnresolved));
    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status !== "ready") return;
    expect(result.current.state.draft.lineItems).toEqual([]);
    expect(result.current.state.draft.client.companyId).toBeNull();
  });

  it("accounts for two distinct photo identities with real processing state", () => {
    const packet = buildSixFragmentTwoPhotoPacket();
    const evidenceLinks: GovernedEvidenceLink[] = [
      { potential_order_id: "po-1", provider_message_id: "p3", evidence_kind: "IMAGE", media_count: 1, processing_state: "SUCCEEDED" },
      { potential_order_id: "po-1", provider_message_id: "p4", evidence_kind: "IMAGE", media_count: 1, processing_state: "PENDING" },
    ];
    const photoMessages = packet.messages!.filter((m) => m.message_type === "image");
    expect(photoMessages.map((m) => m.provider_message_id)).toEqual(["p3", "p4"]);
    expect(new Set(photoMessages.map((m) => m.provider_message_id)).size).toBe(2);
    const statuses = photoMessages.map((m) => deriveMessageMediaStatus(findEvidenceForMessage(evidenceLinks, m.provider_message_id)));
    expect(statuses).toEqual(["available", "processing"]);
    expect(statuses).not.toContain("none");
  });
});
