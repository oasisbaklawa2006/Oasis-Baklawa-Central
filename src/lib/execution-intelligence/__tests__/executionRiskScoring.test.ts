import { describe, expect, it } from "vitest";
import { computeExecutionConfidence, rankExecutionRisks, scoreQueueItemRisk } from "../executionRiskScoring";
import { baseIntelligenceInput, queueItem } from "./fixtures";

describe("executionRiskScoring", () => {
  it("scores higher for blocked escalated items", () => {
    const input = baseIntelligenceInput({
      queueItems: [
        queueItem({
          id: "hot",
          state: "blocked",
          escalationLevel: "tier1",
          blockerCode: "finance",
        }),
      ],
      scans: [
        {
          id: "s1",
          scanType: "order",
          verificationType: "identity_match",
          entityType: "order",
          entityId: "00000000-0000-4000-8000-000000000001",
          orderId: null,
          queueItemId: null,
          barcodeValue: "A",
          expectedBarcode: "B",
          verificationStatus: "mismatch",
          mismatchReason: "x",
          scanSource: "t",
          scanDeviceId: null,
          actorId: null,
          actorRole: null,
          actorDepartment: null,
          photoEvidenceUrl: null,
          metadata: {},
          correlationId: "c",
          idempotencyKey: null,
          createdAt: "2026-05-24T10:00:00.000Z",
        },
      ],
    });
    const risk = scoreQueueItemRisk(input.queueItems[0], input);
    expect(risk.level).toMatch(/high|critical/);
    expect(risk.signals.length).toBeGreaterThan(2);
  });

  it("ranks risks deterministically", () => {
    const a = rankExecutionRisks(baseIntelligenceInput());
    const b = rankExecutionRisks(baseIntelligenceInput());
    expect(a.map((r) => r.entityKey)).toEqual(b.map((r) => r.entityKey));
  });

  it("computes execution confidence", () => {
    const risks = rankExecutionRisks(baseIntelligenceInput());
    expect(computeExecutionConfidence(risks, 1)).toBeLessThan(100);
  });
});
