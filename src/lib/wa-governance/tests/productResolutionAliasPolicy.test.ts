import { describe, expect, it } from "vitest";
import {
  containsIdentityTermAsWholeWord,
  filterIdentityAliases,
  isIdentityAlias,
  isPackagingAlias,
  keywordMatchesIdentityAlias,
} from "@/lib/wa-governance/productResolutionAliasPolicy";

describe("productResolutionAliasPolicy", () => {
  it("classifies packaging aliases separately from identity aliases", () => {
    expect(isPackagingAlias("tin")).toBe(true);
    expect(isPackagingAlias("gift box")).toBe(true);
    expect(isPackagingAlias("hamper")).toBe(true);
    expect(isIdentityAlias("tin")).toBe(false);
    expect(isIdentityAlias("gift box")).toBe(false);
    expect(isIdentityAlias("hamper")).toBe(false);
    expect(isIdentityAlias("Baklawa")).toBe(true);
    expect(isIdentityAlias("Mamoul")).toBe(true);
  });

  it("filters packaging aliases out of identity alias candidates", () => {
    expect(filterIdentityAliases(["tin", "Baklawa", "gift box", "Mamoul"])).toEqual([
      "Baklawa",
      "Mamoul",
    ]);
  });

  it("rejects substring identity aliases like dates inside updates", () => {
    expect(isIdentityAlias("updates")).toBe(false);
    expect(isIdentityAlias("candidate")).toBe(false);
    expect(isIdentityAlias("baklawa123")).toBe(false);
    expect(keywordMatchesIdentityAlias("dates", "order updates")).toBe(false);
    expect(keywordMatchesIdentityAlias("dates", "12 cases of dates")).toBe(true);
    expect(containsIdentityTermAsWholeWord("order updates", "dates")).toBe(false);
    expect(containsIdentityTermAsWholeWord("premium dates box", "dates")).toBe(true);
  });
});
