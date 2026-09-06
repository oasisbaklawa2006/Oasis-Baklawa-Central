import { describe, expect, it } from "vitest";
import { deriveNextBestActions } from "../customerHealthProjection";
import type { CustomerHealthRiskDimension, CustomerHealthUnavailableSignal } from "../customerHealthTypes";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("deriveNextBestActions", () => {
  it("maps engagement risk to Point62 advisory capture capability", () => {
    const dimensions: CustomerHealthRiskDimension[] = [
      {
        dimensionId: "engagement",
        label: "Engagement recency",
        level: "medium",
        score: 45,
        contributingFacts: [
          {
            signalId: "communication_recency",
            availability: "available",
            label: "Last governed CRM communication",
            value: "45 days ago",
            observedAt: "2026-07-20T00:00:00.000Z",
            sourceAuthority: "client_interactions",
            sourceRecordId: "c1",
            freshness: "stale",
            contributesToRisk: true,
          },
        ],
        unavailableInputs: [],
      },
    ];

    const actions = deriveNextBestActions(COMPANY_ID, dimensions, []);
    expect(actions.some((a) => a.capability === "POINT62_capture_call")).toBe(true);
    expect(actions.every((a) => a.availability === "advisory")).toBe(true);
  });

  it("labels finance escalation unavailable when ageing is not governed", () => {
    const dimensions: CustomerHealthRiskDimension[] = [
      {
        dimensionId: "commercial_exposure",
        label: "Commercial exposure",
        level: "high",
        score: 60,
        contributingFacts: [],
        unavailableInputs: [],
      },
    ];
    const unavailable: CustomerHealthUnavailableSignal[] = [
      {
        signalId: "finance_ageing_exposure",
        availability: "unavailable",
        programmeOwner: "POINT77",
        reason: "Not governed",
      },
    ];

    const actions = deriveNextBestActions(COMPANY_ID, dimensions, unavailable);
    const financeAction = actions.find((a) => a.actionId === "finance-exposure-review");
    expect(financeAction?.capability).toBe("POINT77_finance_review");
    expect(financeAction?.availability).toBe("unavailable");
  });
});
