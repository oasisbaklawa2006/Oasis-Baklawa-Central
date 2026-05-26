import { describe, expect, it } from "vitest";
import {
  projectCustomerPublicationPreview,
  suppressInternalFinalizationFromCustomer,
} from "../dispatchPublication";

describe("dispatchPublication", () => {
  it("shows Dispatched and In transit after finalize", () => {
    const steps = projectCustomerPublicationPreview("order-1", new Date().toISOString(), "Carrier X");
    expect(steps.map((s) => s.label)).toEqual(expect.arrayContaining(["Dispatched", "In transit"]));
  });

  it("suppresses reversal and finance from customer feed", () => {
    expect(suppressInternalFinalizationFromCustomer("Finance hold applied", "dispatch_finalized")).toBe(true);
    expect(suppressInternalFinalizationFromCustomer("Reversal requested", "dispatch_reversal_requested")).toBe(true);
    expect(suppressInternalFinalizationFromCustomer("Dispatched", "dispatch_finalized")).toBe(false);
  });
});
