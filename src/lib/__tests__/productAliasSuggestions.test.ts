import { describe, expect, it } from "vitest";
import {
  filterAndDedupeAliasSuggestions,
  isBlockedAlias,
  mergeSelectedAliases,
} from "@/lib/productAliasSuggestions";

describe("productAliasSuggestions", () => {
  it("blocks generic-only aliases", () => {
    expect(isBlockedAlias("baklawa", "Premium Cashew Pyramid")).toBe(true);
    expect(isBlockedAlias("sweet", "Kunafa Roll")).toBe(true);
  });

  it("allows generic terms when combined with distinctive product terms", () => {
    expect(isBlockedAlias("assorted baklawa mix", "Premium Assorted Baklawa Mix")).toBe(false);
  });

  it("deduplicates and filters suggestions", () => {
    const { accepted, rejected } = filterAndDedupeAliasSuggestions(
      ["pyramid", "pyramid", "baklawa", "kitta"],
      "Cashew Pyramid",
      ["kitta"],
    );
    expect(accepted).toEqual(["pyramid"]);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("merges only selected aliases into existing csv", () => {
    expect(mergeSelectedAliases("kitta", ["pyramid"])).toBe("kitta, pyramid");
  });
});
