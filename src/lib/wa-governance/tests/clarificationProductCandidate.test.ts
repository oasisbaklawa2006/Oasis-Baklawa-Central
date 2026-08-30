import { describe, expect, it } from "vitest";
import {
  buildProductAliasLearningCapture,
  clarificationChipCandidates,
  observedProductPhrase,
} from "@/lib/wa-governance/clarificationProductCandidate";
import type { ProductResolutionCandidate } from "@/lib/wa-governance/productResolutionTypes";

const candidate = (id: string, name: string): ProductResolutionCandidate => ({
  productId: id,
  productName: name,
  sku: `SKU-${id}`,
  confidence: 80,
  reasons: ["alias"],
});

describe("clarificationProductCandidate helpers", () => {
  it("deduplicates chip candidates and keeps best match first", () => {
    const best = candidate("p1", "Kaju Pyramid");
    const alternatives = [candidate("p2", "Kaju Round"), candidate("p1", "Duplicate")];
    expect(clarificationChipCandidates(best, alternatives).map((item) => item.productId)).toEqual(["p1", "p2"]);
  });

  it("prefers interpreted order-line product phrase for observed value", () => {
    expect(observedProductPhrase({
      stitchedText: "send kaju",
      orderLineProductName: "kaju pyramd",
      fallback: "fallback",
    })).toBe("kaju pyramd");
  });

  it("builds governed PRODUCT_ALIAS capture payload", () => {
    const payload = buildProductAliasLearningCapture({
      caseId: "case-1",
      packetId: "packet-1",
      candidate: candidate("p1", "Kaju Pyramid"),
      observedValue: "kaju pyramd",
      idempotencyKey: "learning:case-1:p1",
    });
    expect(payload.candidateType).toBe("PRODUCT_ALIAS");
    expect(payload.proposedMapping).toMatchObject({ productId: "p1", sku: "SKU-p1" });
    expect(payload.evidence).toMatchObject({ packet_id: "packet-1", selection: "clarification_product_chip" });
  });

  it("fails closed when observed value is empty", () => {
    expect(() => buildProductAliasLearningCapture({
      caseId: "case-1",
      packetId: "packet-1",
      candidate: candidate("p1", "Kaju Pyramid"),
      observedValue: "   ",
      idempotencyKey: "key",
    })).toThrow("LEARNING_OBSERVED_VALUE_REQUIRED");
  });
});
