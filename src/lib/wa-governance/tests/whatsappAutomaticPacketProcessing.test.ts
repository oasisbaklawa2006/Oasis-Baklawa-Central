import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stitcher = readFileSync("supabase/functions/whatsapp-message-stitcher/index.ts", "utf8");
const productHook = readFileSync("src/components/whatsapp/useOperatorInboxProductResolution.ts", "utf8");
const quantityHook = readFileSync("src/components/whatsapp/useOperatorInboxQuantityResolution.ts", "utf8");

describe("automatic WhatsApp packet processing", () => {
  it("backfills every stitched fragment after commercial intent is established", () => {
    expect(stitcher).toContain("syncCommercialEvidenceForPacket");
    expect(stitcher).toContain("packet_context_backfill");
    expect(stitcher).toContain("capture_whatsapp_potential_order");
    expect(stitcher).toContain("capture_whatsapp_commercial_fragment_for_potential");
    expect(stitcher).toContain("p_interpretation_failed: false");
  });

  it("launches the server packet AI worker after stitching", () => {
    expect(stitcher).toContain("whatsapp-packet-ai-worker");
    expect(stitcher).toContain("Authorization");
    expect(stitcher).toContain("Trusted stitcher caller required");
  });

  it("prefers persisted server AI and does not make quantity resolution start another AI job", () => {
    expect(productHook).toContain("fetchLatestPacketAiInterpretation");
    expect(productHook).toContain('source: persisted ? "server" : "client-fallback"');
    expect(quantityHook).not.toContain("interpretPacketContent(");
    expect(quantityHook).toContain("aiInterpretation?.normalizedText");
  });
});
