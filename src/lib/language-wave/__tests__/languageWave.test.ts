import { describe, expect, it } from "vitest";
import {
  assessBatch001LanguageCoverage,
  BATCH001_SKUS,
  BATCH001_WAVE2C_SKUS,
  buildAliasDraftPayloads,
  buildWave2cProposals,
  filterSafeToApprove,
  resolverCoveragePercent,
  runResolverCoverage,
  scanLanguagePack,
  WAVE2C_ID,
} from "../index";
import { classifyLanguagePack } from "../safeToApprove";

describe("language-wave Wave 2C", () => {
  it("covers 8 remaining Batch 001 SKUs with four term kinds each", () => {
    const proposals = buildWave2cProposals();
    expect(proposals).toHaveLength(32);
    expect(new Set(proposals.map((p) => p.sku)).size).toBe(8);
    for (const sku of BATCH001_WAVE2C_SKUS) {
      const kinds = proposals.filter((p) => p.sku === sku).map((p) => p.kind);
      expect(kinds).toEqual(
        expect.arrayContaining([
          "official_alias",
          "whatsapp_keyword",
          "customer_term",
          "search_keyword",
        ]),
      );
    }
  });

  it("classifies all Wave 2C terms SAFE_TO_APPROVE with no pack collisions", () => {
    const scan = scanLanguagePack(WAVE2C_ID, buildWave2cProposals());
    expect(scan.blocked_count).toBe(0);
    expect(scan.safe_count).toBe(32);
    expect(scan.issues).toHaveLength(0);
  });

  it("blocks unsafe generic-only terms", () => {
    const classified = classifyLanguagePack([
      {
        sku: "OAS-AS-BKL-0006",
        productId: "da4372b9-e1b3-4b17-bdd0-278bd636ab9a",
        canonicalName: "Cashew Pyramid",
        kind: "whatsapp_keyword",
        term: "pyramid",
        wave: WAVE2C_ID,
      },
    ]);
    expect(classified[0]?.classification).toBe("BLOCKED_GENERIC");
  });

  it("builds governed draft payloads only for SAFE_TO_APPROVE terms", () => {
    const safe = filterSafeToApprove(classifyLanguagePack(buildWave2cProposals()));
    const payloads = buildAliasDraftPayloads(safe);
    expect(payloads).toHaveLength(32);
    expect(payloads.every((p) => p.operation === "insert")).toBe(true);
    expect(payloads.every((p) => p.metadata.classification === "SAFE_TO_APPROVE")).toBe(true);
  });

  it("achieves 25/25 language coverage after Wave 2C (17 live + 8 pending)", () => {
    const liveSkus = new Set(
      BATCH001_SKUS.filter((sku) => !BATCH001_WAVE2C_SKUS.includes(sku as (typeof BATCH001_WAVE2C_SKUS)[number])),
    );
    const coverage = assessBatch001LanguageCoverage(liveSkus);
    expect(coverage).toHaveLength(25);
    expect(coverage.filter((c) => c.complete).length).toBe(25);
  });

  it("achieves ≥22/25 resolver coverage; flags known substring-ambiguity SKUs", () => {
    const safe = filterSafeToApprove(classifyLanguagePack(buildWave2cProposals()));
    const payloads = buildAliasDraftPayloads(safe);
    const rows = runResolverCoverage(payloads);
    expect(rows).toHaveLength(25);
    expect(resolverCoveragePercent(rows)).toBeGreaterThanOrEqual(88);

    const ambiguous = rows.filter((r) => !r.resolved).map((r) => r.sku);
    expect(ambiguous.sort()).toEqual([
      "OAS-AS-BKL-0009",
      "OAS-AS-BKL-0014",
      "OAS-AS-BKL-0015",
    ]);
  });
});
