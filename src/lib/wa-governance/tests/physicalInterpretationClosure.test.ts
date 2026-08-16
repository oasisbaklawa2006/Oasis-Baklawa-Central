import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { resolveQuantityCandidates } from "../fetchQuantityResolution";
import {
  interpretPacketContent,
  normalizeHindiCommerceFallback,
  type InterpretablePacketMessage,
} from "../packetContentInterpretation";
import { extractProductResolutionTextSignals } from "../productResolutionSignals";

function imageMessage(index: number, providerId = `provider-image-${index}`): InterpretablePacketMessage {
  return {
    id: `message-${index}`,
    direction: "inbound",
    content: "",
    message_type: "image",
    provider_message_id: providerId,
    media_url: `https://media.example.test/${index}.jpg`,
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
  });

  it("bounds concurrent interpreter invokes to two", async () => {
    let active = 0;
    let maxActive = 0;
    let invokeCount = 0;
    const fakeSupabase = {
      functions: {
        invoke: async () => {
          invokeCount += 1;
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
          return {
            data: {
              success: true,
              interpretation: { normalized_text: "5 kg pyramid" },
            },
            error: null,
          };
        },
      },
    } as unknown as SupabaseClient;

    const result = await interpretPacketContent(
      fakeSupabase,
      Array.from({ length: 5 }, (_, index) => imageMessage(index + 100)),
    );

    expect(invokeCount).toBe(5);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(result.split("\n")).toHaveLength(5);
  });

  it("reuses the bounded cache for the same provider identity", async () => {
    let invokeCount = 0;
    const fakeSupabase = {
      functions: {
        invoke: async () => {
          invokeCount += 1;
          return {
            data: {
              success: true,
              interpretation: { normalized_text: "2 box chocolate" },
            },
            error: null,
          };
        },
      },
    } as unknown as SupabaseClient;

    const message = imageMessage(201, "provider-cache-201");
    expect(await interpretPacketContent(fakeSupabase, [message])).toBe("2 box chocolate");
    expect(await interpretPacketContent(fakeSupabase, [message])).toBe("2 box chocolate");
    expect(invokeCount).toBe(1);
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
        Array.from({ length: 17 }, (_, index) => imageMessage(index + 300)),
      ),
    ).rejects.toThrow("INTERPRETATION_PACKET_TOO_LARGE");
    expect(invokeCount).toBe(0);
  });
});
