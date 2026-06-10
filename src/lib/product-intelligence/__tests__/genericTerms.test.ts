import { describe, expect, it } from "vitest";
import { isGenericFamilyUtterance } from "../genericTerms";
import { extractUtteranceSignals } from "../utteranceSignals";

function isGenericUtterance(utterance: string): boolean {
  return isGenericFamilyUtterance(extractUtteranceSignals(utterance).normalized);
}

describe("isGenericFamilyUtterance", () => {
  const specificPhrases = [
    "Pistachio Pyramid",
    "Cashew Ring",
    "Mix Nut Tart",
    "Coconut Durum",
    "Chocolate Pistachio Asiyah",
    "Mor Cashew Asiyah",
    "Need Pistachio Pyramid",
    "Send Mor Cashew Asiyah",
    "Mix Nut Tart 500gm",
    "Coconut Durum 1 kg",
    "send pistachio pyramid",
    "please send cashew ring",
    "need mor cashew asiyah",
  ];

  const genericOnlyPhrases = [
    "Pyramid",
    "Ring",
    "Tart",
    "Durum",
    "Asiyah",
    "Baklava",
    "Baklawa",
    "Need Baklava",
    "Need Baklawa",
    "Need Asiyah",
    "send pyramid",
    "mixed sweets",
    "please send baklava",
    "kindly send baklava",
    "please give asiyah",
    "send baklava",
    "need asiyah",
    "please share tart",
  ];

  it.each(specificPhrases)('does not treat "%s" as generic-only', (utterance) => {
    expect(isGenericUtterance(utterance)).toBe(false);
  });

  it.each(genericOnlyPhrases)('treats "%s" as generic-only', (utterance) => {
    expect(isGenericUtterance(utterance)).toBe(true);
  });

  it("does not classify by last token alone when earlier tokens are specific", () => {
    expect(isGenericFamilyUtterance("pistachio pyramid")).toBe(false);
    expect(isGenericFamilyUtterance("cashew ring")).toBe(false);
    expect(isGenericFamilyUtterance("mix nut tart")).toBe(false);
    expect(isGenericFamilyUtterance("coconut durum")).toBe(false);
    expect(isGenericFamilyUtterance("chocolate pistachio asiyah")).toBe(false);
    expect(isGenericFamilyUtterance("mor cashew asiyah")).toBe(false);
  });
});
