import { describe, expect, it } from "vitest";
import {
  escapePostgrestIlikePattern,
  postgrestIlikeContainsPattern,
  postgrestOrIlikeContains,
} from "@/lib/wa-governance/clientResolutionIlike";

describe("clientResolutionIlike", () => {
  it("escapes percent and underscore wildcards literally", () => {
    expect(escapePostgrestIlikePattern("A%")).toBe("A\\%");
    expect(escapePostgrestIlikePattern("A_B")).toBe("A\\_B");
    expect(escapePostgrestIlikePattern("100\\done")).toBe("100\\\\done");
  });

  it("wraps escaped terms in contains patterns", () => {
    expect(postgrestIlikeContainsPattern("A%")).toBe("%A\\%%");
    expect(postgrestIlikeContainsPattern("A_B")).toBe("%A\\_B%");
  });

  it("builds escaped PostgREST or-filter ilike fragments", () => {
    expect(postgrestOrIlikeContains("business_name", "A%")).toBe("business_name.ilike.%A\\%%");
    expect(postgrestOrIlikeContains("city", "A_B")).toBe("city.ilike.%A\\_B%");
  });
});
