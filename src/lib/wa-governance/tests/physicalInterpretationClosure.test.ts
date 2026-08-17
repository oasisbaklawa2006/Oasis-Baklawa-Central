import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { resolveQuantityCandidates } from "../fetchQuantityResolution";
import {
  interpretPacketContent,
  interpretPacketContentRich,
  normalizeHindiCommerceFallback,
  type InterpretablePacketMessage,
} from "../packetContentInterpretation";
import { extractProductResolutionTextSignals } from "../productResolutionSignals";

function mediaMessage(
  index: number,
  messageType: "image" | "audio" | "video" | "document" = "image",
  providerId = `provider-${messageType}-${index}`,
): InterpretablePacketMessage {
  return {
    id: `message-${index}`,
    direction: "inbound",
    content: "",
    message_type: messageType,
    provider_message_id: providerId,
    media_url: `https://media.example.test/${index}`,
  };
}

function textMessage(index: number, content: string): InterpretablePacketMessage {
  return {
    id: `text-${index}`,
    direction: "inbound",
    content,
    message_type: "text",
    provider_message_id: `provider-text-${index}`,
    media_url: null,
  };
}

function successfulPacketResponse(normalizedText = "5 kg pyramid") {
  return {
    data: {
      success: true,
      interpretation: {
        normalized_text: normalizedText,
        extracted_text: normalizedText,
        language: "Hindi/Hinglish/English",
        confidence: 0.96,
        warnings: [],
        source_kind: "packet",
        conclusion: {
          intent: "NEW_ORDER",
          summary: "Customer is placing a B2B order.",
          explicit_facts: [],
          order_lines: [{
            product_name: "Pyramid",
            sku: "",
            quantity: 5,
            unit: "kg",
            status: "interpreted",
            evidence_ids: ["provider-text-1"],
          }],
          corrections: [],
          ambiguities: [],
          recommended_action: "Human to confirm the interpreted line before commitment.",
          human_review_required: true,
        },
      },
    },
    error: null,
  };
}

describe("WhatsApp physical interpretation closure", () => {
  it("keeps direct weight syntax when the product is catalogue-backed", async () => {
    const result = await resolveQuantityCandidates({
      messageText: "5kg pyramid",
      stitchedPlainText: "",
      productId: "product-pyramid",
      productBestMatchName: "Pyramid Pistachio",
    }, null);

    expect(result.quantities).toHaveLength(1);
    expect(result.quantities[0]?.rawQuantity).toBe(5);
    expect(result.quantities[0]?.rawUnit).toBe("kg");
    expect(result.quantities[0]?.productHint?.toLowerCase()).toContain("pyramid");
  });

  it("does not treat 5g phone chatter as a product quantity without a catalogue match", async () => {
    const result = await resolveQuantityCandidates({
      messageText: "my 5g phone can't load images",
      stitchedPlainText: "",
      productId: null,
      productBestMatchName: null,
    }, null);

    expect(result.quantities).toHaveLength(0);
  });

  it("does not treat arbitrary trailing prose as a direct-weight product", async () => {
    const result = await resolveQuantityCandidates({
      messageText: "5kg please confirm",
      stitchedPlainText: "",
      productId: null,
      productBestMatchName: null,
    }, null);

    expect(result.quantities).toHaveLength(0);
  });

  it("exposes a direct quantity product phrase only as a catalogue lookup hint", () => {
    const signals = extractProductResolutionTextSignals("10 kg finger");
    expect(signals.productNameCandidates.map((value) => value.toLowerCase())).toContain("finger");
  });

  it("normalizes simple Hindi order text without changing explicit quantities", () => {
    expect(normalizeHindiCommerceFallback("५ किलो पिरामिड चाहिए")).toBe("5 kg pyramid need");
    expect(normalizeHindiCommerceFallback("२ बॉक्स चॉकलेट भेजो")).toBe("2 box chocolate send");
    expect(normalizeHindiCommerceFallback("१० किलो फिंगर ऑर्डर")).toBe("10 kg finger order");
    expect(normalizeHindiCommerceFallback("तीन किलो काजू पिरामिड भी डालना")).toContain("kg kaju pyramid");
  });

  it("sends the whole eligible packet to one governed AI invoke", async () => {
    let invokeCount = 0;
    let capturedBody: unknown = null;
    const fakeSupabase = {
      functions: {
        invoke: async (_slug: string, options: { body: unknown }) => {
          invokeCount += 1;
          capturedBody = options.body;
          return successfulPacketResponse("5 kg pyramid\n10 kg finger\n2 box chocolate");
        },
      },
    } as unknown as SupabaseClient;

    const messages = [
      textMessage(1, "snd 5 kg kaju pyramd same as lst tym"),
      textMessage(2, "१० किलो फिंगर ऑर्डर"),
      mediaMessage(3, "image"),
      mediaMessage(4, "audio"),
      mediaMessage(5, "video"),
      mediaMessage(6, "document"),
    ];

    const result = await interpretPacketContentRich(fakeSupabase, messages);

    expect(invokeCount).toBe(1);
    expect(capturedBody).toEqual({
      provider_message_ids: messages.map((message) => message.provider_message_id),
    });
    expect(result.usedAi).toBe(true);
    expect(result.conclusion?.intent).toBe("NEW_ORDER");
    expect(result.conclusion?.human_review_required).toBe(true);
    expect(result.normalizedText).toContain("10 kg finger");
  });

  it("treats ordinary English and Roman Hinglish as AI-interpretable evidence", async () => {
    let capturedBody: unknown = null;
    const fakeSupabase = {
      functions: {
        invoke: async (_slug: string, options: { body: unknown }) => {
          capturedBody = options.body;
          return successfulPacketResponse("need 5 kg kaju pyramid");
        },
      },
    } as unknown as SupabaseClient;

    await interpretPacketContent(
      fakeSupabase,
      [textMessage(21, "mujhe 5 kilo kaju pyramd bhej do")],
    );

    expect(capturedBody).toEqual({ provider_message_ids: ["provider-text-21"] });
  });

  it("reuses one bounded packet cache for the same evidence identities", async () => {
    let invokeCount = 0;
    const fakeSupabase = {
      functions: {
        invoke: async () => {
          invokeCount += 1;
          return successfulPacketResponse("2 box chocolate");
        },
      },
    } as unknown as SupabaseClient;

    const messages = [mediaMessage(201, "image", "provider-cache-201")];
    expect(await interpretPacketContent(fakeSupabase, messages)).toBe("2 box chocolate");
    expect(await interpretPacketContent(fakeSupabase, messages)).toBe("2 box chocolate");
    expect(invokeCount).toBe(1);
  });

  it("falls back to immutable source text when AI invocation fails", async () => {
    const fakeSupabase = {
      functions: {
        invoke: async () => ({
          data: null,
          error: { message: "provider unavailable" },
        }),
      },
    } as unknown as SupabaseClient;

    const result = await interpretPacketContentRich(fakeSupabase, [
      textMessage(401, "५ किलो पिरामिड चाहिए"),
      textMessage(402, "and 10 kg finger"),
    ]);

    expect(result.usedAi).toBe(false);
    expect(result.normalizedText).toContain("5 kg pyramid need");
    expect(result.normalizedText).toContain("10 kg finger");
    expect(result.conclusion).toBeNull();
    expect(result.warnings.join(" ")).toContain("AI interpretation unavailable");
  });

  it("fails closed before invoking when too many messages require interpretation", async () => {
    let invokeCount = 0;
    const fakeSupabase = {
      functions: {
        invoke: async () => {
          invokeCount += 1;
          return { data: null, error: null };
        },
      },
    } as unknown as SupabaseClient;

    await expect(
      interpretPacketContent(
        fakeSupabase,
        Array.from({ length: 17 }, (_, index) => mediaMessage(index + 300)),
      ),
    ).rejects.toThrow("INTERPRETATION_PACKET_TOO_LARGE");
    expect(invokeCount).toBe(0);
  });
});
