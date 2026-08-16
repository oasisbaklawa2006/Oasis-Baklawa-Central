import { describe, expect, it } from "vitest";
import { resolveQuantityCandidates } from "../fetchQuantityResolution";
import { normalizeHindiCommerceFallback } from "../packetContentInterpretation";
import { extractProductResolutionTextSignals } from "../productResolutionSignals";

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
});
