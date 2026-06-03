import { describe, expect, it } from "vitest";
import type { ClientResolutionResult } from "@/lib/wa-governance/clientResolutionTypes";
import {
  getCachedClientResolutionState,
  storeCachedClientResolutionResult,
} from "@/lib/wa-governance/clientResolutionResultCache";

const sampleResult = (): ClientResolutionResult => ({
  candidateClients: [
    {
      companyId: "c-1",
      companyName: "HDFC Bank",
      ownerId: "owner-1",
      ownerName: "Anita Mehta",
      confidence: 96,
      reasons: ["Company name \"HDFC Bank\" appears in message"],
    },
  ],
  bestMatch: {
    companyId: "c-1",
    companyName: "HDFC Bank",
    ownerId: "owner-1",
    ownerName: "Anita Mehta",
    confidence: 96,
    reasons: ["Company name \"HDFC Bank\" appears in message"],
  },
  band: "auto_highlight",
});

describe("clientResolutionResultCache", () => {
  it("returns ready state when lookupKey is cached", () => {
    const cache = new Map<string, ClientResolutionResult>();
    const lookupKey = "packet-1:hash:employee";
    storeCachedClientResolutionResult(cache, lookupKey, sampleResult());

    expect(getCachedClientResolutionState(lookupKey, cache)).toEqual({
      status: "ready",
      result: sampleResult(),
    });
  });

  it("returns null when lookupKey is not cached", () => {
    const cache = new Map<string, ClientResolutionResult>();
    expect(getCachedClientResolutionState("missing-key", cache)).toBeNull();
  });

  it("stores only successful payloads keyed by lookupKey", () => {
    const cache = new Map<string, ClientResolutionResult>();
    const firstKey = "packet-a:hash:employee";
    const secondKey = "packet-b:hash:customer";

    storeCachedClientResolutionResult(cache, firstKey, sampleResult());
    storeCachedClientResolutionResult(cache, secondKey, {
      ...sampleResult(),
      band: "suggested",
    });

    expect(cache.size).toBe(2);
    expect(getCachedClientResolutionState(firstKey, cache)?.result.band).toBe("auto_highlight");
    expect(getCachedClientResolutionState(secondKey, cache)?.result.band).toBe("suggested");
  });
});
