import { describe, expect, it } from "vitest";
import {
  isPostgrestIlikeQueryableTerm,
  postgrestIlikeContainsPattern,
} from "@/lib/wa-governance/clientResolutionIlike";

describe("clientResolutionIlike", () => {
  it("rejects blank and whitespace-only ILIKE terms", () => {
    expect(isPostgrestIlikeQueryableTerm("")).toBe(false);
    expect(isPostgrestIlikeQueryableTerm("   ")).toBe(false);
    expect(isPostgrestIlikeQueryableTerm("a")).toBe(false);
    expect(isPostgrestIlikeQueryableTerm("ab")).toBe(true);
  });

  it("escapes wildcard characters in ILIKE patterns", () => {
    expect(postgrestIlikeContainsPattern("A%")).toBe("%A\\%%");
    expect(postgrestIlikeContainsPattern("%")).toBe("%\\%%");
  });
});
