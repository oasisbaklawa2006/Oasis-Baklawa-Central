import { describe, expect, it } from "vitest";
import { extractClientResolutionTextSignals } from "@/lib/wa-governance/clientResolutionSignals";
import {
  CLIENT_RESOLUTION_SIGNAL_WEIGHTS,
  confidenceBandFromPercent,
  scoreClientResolutionCandidates,
} from "@/lib/wa-governance/clientResolutionScoring";
import type {
  ClientResolutionTextSignals,
  CompanyResolutionRow,
  OwnerProfileRow,
} from "@/lib/wa-governance/clientResolutionTypes";

const ownerProfiles = new Map<string, OwnerProfileRow>([
  ["owner-1", { id: "owner-1", full_name: "Anita Mehta", name: null }],
  ["owner-2", { id: "owner-2", full_name: "Ravi Khanna", name: null }],
]);

function company(partial: Partial<CompanyResolutionRow> & Pick<CompanyResolutionRow, "id" | "business_name">): CompanyResolutionRow {
  return {
    account_manager_id: null,
    phone: null,
    gst_number: null,
    status: "active",
    registered_address: null,
    ...partial,
  };
}

const baseSignals = (overrides: Partial<ClientResolutionTextSignals> = {}): ClientResolutionTextSignals => ({
  combinedText: "",
  nameCandidates: [],
  gstNumbers: [],
  phoneLast10: [],
  orderReferences: [],
  numericCodes: [],
  locationTokens: [],
  ...overrides,
});

describe("clientResolutionScoring", () => {
  it("scores exact company name match at auto-highlight band", () => {
    const result = scoreClientResolutionCandidates({
      signals: baseSignals({ nameCandidates: ["HDFC Bank"] }),
      companies: [
        company({
          id: "c-hdfc",
          business_name: "HDFC Bank",
          account_manager_id: "owner-1",
        }),
      ],
      ownerProfiles,
      senderIsEmployee: true,
    });

    expect(result.bestMatch?.companyName).toBe("HDFC Bank");
    expect(result.bestMatch?.ownerName).toBe("Anita Mehta");
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(95);
    expect(result.band).toBe("auto_highlight");
  });

  it("scores WhatsApp contact alias as suggested match", () => {
    const result = scoreClientResolutionCandidates({
      signals: baseSignals({ nameCandidates: ["Bikanervala"] }),
      companies: [
        company({
          id: "c-bikaner",
          business_name: "Bikanervala Connaught Place",
          account_manager_id: "owner-2",
        }),
      ],
      ownerProfiles,
      waCompanyName: "Bikanervala Connaught",
    });

    expect(result.bestMatch?.companyName).toContain("Bikanervala");
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(70);
    expect(result.bestMatch?.confidence).toBeLessThan(95);
    expect(result.band).toBe("suggested");
  });

  it("scores contact name mention as customer/contact match", () => {
    const result = scoreClientResolutionCandidates({
      signals: baseSignals({ nameCandidates: ["Rajesh Traders"] }),
      companies: [
        company({
          id: "c-rajesh",
          business_name: "Rajesh Traders Gurgaon",
          account_manager_id: "owner-1",
        }),
      ],
      ownerProfiles,
      waCustomerName: "Rajesh Traders",
      senderIsEmployee: true,
    });

    expect(result.bestMatch?.companyName).toContain("Rajesh Traders");
    expect(result.bestMatch?.reasons.some((reason) => reason.includes("WhatsApp contact"))).toBe(true);
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(70);
  });

  it("returns ambiguous matches when multiple companies score similarly", () => {
    const result = scoreClientResolutionCandidates({
      signals: baseSignals({ nameCandidates: ["Haldiram"] }),
      companies: [
        company({ id: "c-1", business_name: "Haldiram Delhi", account_manager_id: "owner-1" }),
        company({ id: "c-2", business_name: "Haldiram Noida", account_manager_id: "owner-2" }),
      ],
      ownerProfiles,
      senderIsEmployee: true,
    });

    expect(result.candidateClients.length).toBeGreaterThanOrEqual(2);
    expect(result.candidateClients[0].confidence).toBeGreaterThan(0);
    expect(Math.abs(result.candidateClients[0].confidence - result.candidateClients[1].confidence)).toBeLessThan(15);
  });

  it("returns needs clarification when no companies match", () => {
    const result = scoreClientResolutionCandidates({
      signals: baseSignals({ nameCandidates: ["Unknown Party XYZ"] }),
      companies: [],
      ownerProfiles,
    });

    expect(result.bestMatch).toBeNull();
    expect(result.band).toBe("needs_clarification");
    expect(result.candidateClients).toHaveLength(0);
  });

  it("maps confidence bands", () => {
    expect(confidenceBandFromPercent(96)).toBe("auto_highlight");
    expect(confidenceBandFromPercent(82)).toBe("suggested");
    expect(confidenceBandFromPercent(40)).toBe("needs_clarification");
  });

  it("includes order reference reason when provided", () => {
    const result = scoreClientResolutionCandidates({
      signals: baseSignals(),
      companies: [company({ id: "c-order", business_name: "Ramesh Traders", account_manager_id: "owner-1" })],
      ownerProfiles,
      additionalReasons: new Map([
        [
          "c-order",
          [
            {
              companyId: "c-order",
              weight: CLIENT_RESOLUTION_SIGNAL_WEIGHTS.orderReference,
              reason: 'Previous order reference "SO-12345" linked to company',
            },
          ],
        ],
      ]),
    });

    expect(result.bestMatch?.reasons).toContain('Previous order reference "SO-12345" linked to company');
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(30);
  });
});

describe("clientResolutionSignals", () => {
  it("extracts relay client names from employee-style messages", () => {
    const signals = extractClientResolutionTextSignals("Need 50 boxes for HDFC", "");
    expect(signals.nameCandidates.some((name) => /hdfc/i.test(name))).toBe(true);
  });

  it("extracts client code and location tokens", () => {
    const signals = extractClientResolutionTextSignals(
      "Client code 8472 for Bikanervala CP urgent",
      "",
    );
    expect(signals.numericCodes).toContain("8472");
    expect(signals.locationTokens).toContain("cp");
  });
});
