import { describe, expect, it } from "vitest";
import {
  buildSenderIdentityDisplayLabels,
  formatSenderConfidence,
  mapSenderKindToDisplayCategory,
} from "@/lib/wa-governance/senderIdentityDisplay";
import type { SenderIdentityViewModel } from "@/lib/wa-governance/senderIdentityTypes";

const baseModel = (): SenderIdentityViewModel => ({
  kind: "unknown",
  confidence: 0.4,
  normalizedPhone: "919876543210",
  employeeProfile: null,
  roleFromEdge: null,
  matchedVia: null,
  contactId: null,
  customerName: null,
  companyName: null,
  reason: "no_staff_or_whatsapp_contact_match",
});

describe("senderIdentityDisplay", () => {
  it("maps sender kinds to display categories", () => {
    expect(mapSenderKindToDisplayCategory("employee")).toBe("internal");
    expect(mapSenderKindToDisplayCategory("customer")).toBe("customer");
    expect(mapSenderKindToDisplayCategory("spam")).toBe("spam");
    expect(mapSenderKindToDisplayCategory("unknown")).toBe("unknown");
  });

  it("labels employee senders as Order Creator candidate", () => {
    const labels = buildSenderIdentityDisplayLabels({
      ...baseModel(),
      kind: "employee",
      confidence: 0.9,
      roleFromEdge: "SALES_EXECUTIVE",
      employeeProfile: {
        id: "u1",
        full_name: "Priya Sharma",
        name: null,
        role: "SALES_EXECUTIVE",
        department: "Sales",
        designation: null,
        is_sales_executive: true,
      },
    });
    expect(labels.title).toBe("Internal employee");
    expect(labels.subtitle).toContain("Priya Sharma");
    expect(labels.subtitle).toContain("Order Creator candidate");
  });

  it("labels customer senders as direct customer message", () => {
    const labels = buildSenderIdentityDisplayLabels({
      ...baseModel(),
      kind: "customer",
      customerName: "Ramesh Traders",
      companyName: "Ramesh Traders Pvt Ltd",
    });
    expect(labels.title).toBe("Customer / contact");
    expect(labels.subtitle).toContain("Direct customer message");
  });

  it("labels unknown senders with clarification hint", () => {
    const labels = buildSenderIdentityDisplayLabels(baseModel());
    expect(labels.title).toBe("Unknown sender");
    expect(labels.subtitle).toContain("needs clarification");
  });

  it("formats confidence as percentage", () => {
    expect(formatSenderConfidence(0.82)).toBe("82%");
    expect(formatSenderConfidence(null)).toBeNull();
  });
});
