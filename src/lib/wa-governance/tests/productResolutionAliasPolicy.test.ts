import { describe, expect, it } from "vitest";
import {
  filterIdentityAliases,
  isIdentityAlias,
  isPackagingAlias,
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
});
