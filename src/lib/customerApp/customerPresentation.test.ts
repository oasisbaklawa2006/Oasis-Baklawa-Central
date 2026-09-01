import { describe, expect, it } from "vitest";
import {
  buildCustomerOrderTimeline,
  customerDocumentAvailabilityLabel,
  customerFinanceAction,
  customerFinanceStatusLabel,
  customerGeneralQueryStatusLabel,
  customerOrderAction,
  customerOrderStageLabel,
  customerPaymentStageLabel,
  customerReadinessMessages,
} from "./customerPresentation";

describe("customer-safe Buyer presentation", () => {
  it("translates governed order and payment stages without exposing enums", () => {
    expect(customerOrderStageLabel("in_production")).toBe("Being prepared");
    expect(customerPaymentStageLabel("awaiting_receipt")).toBe("Payment details needed");
    expect(customerOrderAction("rejected")).toBe("Payment update needed");
    expect(customerOrderStageLabel("new_internal_stage")).toBe("Order in progress");
    expect(customerPaymentStageLabel(undefined)).toBe("Payment status will appear when available");
  });

  it("builds a safe, presentation-only progress timeline", () => {
    const steps = buildCustomerOrderTimeline({ customerStage: "dispatched", paymentStage: "cleared", orderNumber: "SO2026/08-0001" });
    expect(steps.map((step) => step.label)).toEqual([
      "Order received",
      "Sales order confirmed",
      "Payment review",
      "Preparing your order",
      "Dispatch",
      "Delivered",
    ]);
    expect(steps.find((step) => step.id === "dispatch")?.state).toBe("current");
    expect(steps.find((step) => step.id === "delivery")?.state).toBe("upcoming");
    const unknownTimeline = buildCustomerOrderTimeline({ customerStage: "unrecognised", paymentStage: "unknown", orderNumber: null });
    expect(unknownTimeline[0].label).toBe("Order received");
    expect(unknownTimeline.find((step) => step.id === "payment")?.state).toBe("current");
    expect(unknownTimeline.filter((step) => step.state === "current").map((step) => step.id)).toEqual(["payment"]);
  });

  it("turns authoritative readiness details into actionable customer copy", () => {
    expect(customerReadinessMessages([{ code: "MOQ_NOT_MET" }], 12, "cartons")).toEqual(["Minimum order is 12 cartons."]);
    expect(customerReadinessMessages([{ message: "Carton increment required" }], null, null)).toEqual(["Adjust the quantity to the approved carton or order increment."]);
    expect(customerReadinessMessages([{ code: "INVENTORY_UNAVAILABLE", detail: "Internal inventory detail" }], null, null)).toEqual(["Review the quantity and carton requirements before submitting."]);
    expect(customerReadinessMessages([], null, null)).toEqual(["Review the quantity and carton requirements before submitting."]);
  });

  it("maps authoritative Finance and document states without exposing enums", () => {
    expect(customerFinanceStatusLabel("advance_pending")).toBe("Advance payment is needed");
    expect(customerFinanceAction("advance_pending")).toBe("Advance payment is needed");
    expect(customerFinanceStatusLabel("clearance_revoked")).toBe("Finance clearance needs review");
    expect(customerFinanceAction("clearance_revoked")).toBe("Finance review required");
    expect(customerFinanceStatusLabel("future_internal_status")).toBe("Finance status will appear when available");
    expect(customerFinanceAction("future_internal_status")).toBeNull();
    expect(customerDocumentAvailabilityLabel("issued")).toBe("Available");
    expect(customerDocumentAvailabilityLabel("preparing")).toBe("Preparing");
    expect(customerDocumentAvailabilityLabel("unavailable")).toBe("Not available yet");
  });

  it("keeps general-enquiry lifecycle wording bounded", () => {
    expect(customerGeneralQueryStatusLabel("SUBMITTED")).toBe("Submitted");
    expect(customerGeneralQueryStatusLabel("ACKNOWLEDGED")).toBe("Acknowledged");
    expect(customerGeneralQueryStatusLabel("RESOLVED")).toBe("Resolved");
    expect(customerGeneralQueryStatusLabel("CLOSED")).toBe("Closed");
    expect(customerGeneralQueryStatusLabel("internal_queue_state")).toBe("Submitted");
  });
});
