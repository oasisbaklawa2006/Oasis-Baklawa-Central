import { describe, expect, it } from "vitest";
import { extractDraftOrderFromResolution } from "@/lib/wa-governance/draftOrderExtraction";
import { buildDraftOrderGovernanceRoles } from "@/lib/wa-governance/draftOrderGovernance";
import { computeDraftOrderReadiness } from "@/lib/wa-governance/draftOrderReadinessScoring";
import { extractAddressPaymentTextSignals } from "@/lib/wa-governance/draftOrderTextSignals";
import type { ClientResolutionResult } from "@/lib/wa-governance/clientResolutionTypes";
import type { ProductResolutionResult } from "@/lib/wa-governance/productResolutionTypes";
import type { QuantityResolutionResult } from "@/lib/wa-governance/quantityResolutionTypes";

const clientReady: ClientResolutionResult = {
  band: "auto_highlight",
  bestMatch: {
    companyId: "co-1",
    companyName: "Bikaner Traders",
    ownerId: "owner-1",
    ownerName: "Priya Sales",
    confidence: 88,
    reasons: ["Phone match", "Name overlap"],
  },
  candidateClients: [],
};

const productReady: ProductResolutionResult = {
  band: "suggested",
  bestMatch: {
    productId: "prod-1",
    productName: "Premium Baklawa Box",
    sku: "BKW-500",
    confidence: 76,
    reasons: ["Alias match"],
  },
  candidateProducts: [],
};

const quantityReady: QuantityResolutionResult = {
  band: "auto_highlight",
  quantities: [
    {
      rawQuantity: 10,
      rawUnit: "boxes",
      normalizedQuantity: 10,
      normalizedUnit: "boxes",
      conversionSource: "catalogue",
      conversionStatus: "resolved",
      productHint: "baklawa",
      confidence: 91,
      reasons: ['Detected "10 boxes"'],
      band: "auto_highlight",
    },
  ],
};

describe("draftOrderExtraction", () => {
  it("combines WA-04A/05A/06A into structured draft lines without order ids", () => {
    const draft = extractDraftOrderFromResolution({
      packetId: "pkt-1",
      extractionRequestKey: "key-1",
      sourceText: "Need 10 boxes baklawa for Bikaner Traders. Pincode 110001. Advance payment.",
      client: clientReady,
      product: productReady,
      quantity: quantityReady,
      senderIdentity: null,
    });

    expect(draft.status).toBe("ready");
    expect(draft.client.companyName).toBe("Bikaner Traders");
    expect(draft.lineItems).toHaveLength(1);
    expect(draft.lineItems[0].productName).toBe("Premium Baklawa Box");
    expect(draft.lineItems[0].rawQuantity).toBe(10);
    expect(draft.conversionSummary.some((line) => line.includes("does not insert"))).toBe(true);
    expect(JSON.stringify(draft)).not.toMatch(/order_id|"orders"/);
  });

  it("preserves client owner in governance slots", () => {
    const governance = buildDraftOrderGovernanceRoles({
      client: clientReady,
      senderIdentity: {
        kind: "employee",
        confidence: 90,
        normalizedPhone: "9876543210",
        employeeProfile: {
          id: "emp-1",
          full_name: "Rahul Ops",
          name: "Rahul",
          role: "SUPPORT_EXECUTIVE",
          department: null,
          designation: null,
          is_sales_executive: false,
        },
        roleFromEdge: "SUPPORT_EXECUTIVE",
        matchedVia: "phone",
        contactId: null,
        customerName: null,
        companyName: null,
        reason: null,
      },
    });

    expect(governance.clientOwnerName).toBe("Priya Sales");
    expect(governance.orderCreatorName).toBe("Rahul Ops");
    expect(governance.orderHandlerName).toBe("Priya Sales");
    expect(governance.approverId).toBeNull();
  });
});

describe("draftOrderReadinessScoring", () => {
  it("scores all five readiness dimensions", () => {
    const text =
      "Deliver to Sector 18 Noida pincode 201301. Need 10 boxes. Payment terms net 30 advance 20%.";
    const signals = extractAddressPaymentTextSignals(text);
    expect(signals.hasPincode).toBe(true);
    expect(signals.hasPaymentTermsKeyword).toBe(true);

    const readiness = computeDraftOrderReadiness({
      client: clientReady,
      product: productReady,
      quantity: quantityReady,
      combinedText: text,
    });

    expect(readiness.dimensions).toHaveLength(5);
    expect(readiness.overallScore).toBeGreaterThan(0);
    expect(readiness.dimensions.map((d) => d.dimension)).toEqual([
      "client",
      "product",
      "quantity",
      "address",
      "payment_terms",
    ]);
  });
});
