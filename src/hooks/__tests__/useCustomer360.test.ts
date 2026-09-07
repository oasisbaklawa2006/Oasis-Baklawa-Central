import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer360ReadModel } from "@/lib/customer-360/customer360Types";

const COMPANY_A = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const COMPANY_B = "00000000-0000-4000-8000-000000000001";

const fetchCustomer360ReadModel = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    companyId: null,
    role: "ADMIN",
  }),
}));

vi.mock("@/lib/customer-360/customer360ReadModel", () => ({
  fetchCustomer360ReadModel: (...args: unknown[]) => fetchCustomer360ReadModel(...args),
}));

import { useCustomer360 } from "@/hooks/useCustomer360";

function readyModel(companyId: string, businessName: string): Customer360ReadModel {
  return {
    identity: { companyId, resolvedAt: "2026-01-01T00:00:00.000Z" },
    profile: {
      availability: "available",
      programmeOwner: "POINT59",
      data: {
        companyId,
        businessName,
        status: "active",
        phone: null,
        registeredAddress: null,
        gstNumber: null,
        accountManagerId: null,
        allowCredit: null,
        creditLimit: null,
        walletBalance: null,
        currentBalance: null,
        totalOutstanding: 0,
        discountPercentage: null,
        paymentTerms: null,
        priceTier: null,
        createdAt: null,
      },
    },
    orders: { availability: "available", programmeOwner: "POINT59", data: [] },
    interactions: { availability: "partial_crm_lite", programmeOwner: "POINT61", data: [] },
    tasks: { availability: "partial_crm_lite", programmeOwner: "POINT63", data: [] },
    tickets: { availability: "available", programmeOwner: "POINT59", data: [] },
    branchesAndContacts: { availability: "unavailable_not_governed", programmeOwner: "POINT60" },
    communicationsLedger: { availability: "unavailable_not_governed", programmeOwner: "POINT61" },
    dispatchHistory: { availability: "unavailable_not_governed", programmeOwner: "DISPATCH_P0_456" },
    financeExposure: { availability: "unavailable_not_governed", programmeOwner: "POINT77" },
    customerHealth: { availability: "unavailable_not_governed", programmeOwner: "POINT64" },
  };
}

describe("useCustomer360 stale request guarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not apply a stale company response after navigating to a newer companyId", async () => {
    let resolveA: ((value: Customer360ReadModel) => void) | undefined;
    let resolveB: ((value: Customer360ReadModel) => void) | undefined;

    fetchCustomer360ReadModel.mockImplementation((companyId: string) => {
      if (companyId === COMPANY_A) {
        return new Promise<Customer360ReadModel>((resolve) => {
          resolveA = resolve;
        });
      }
      if (companyId === COMPANY_B) {
        return new Promise<Customer360ReadModel>((resolve) => {
          resolveB = resolve;
        });
      }
      return Promise.reject(new Error(`Unexpected company ${companyId}`));
    });

    const { result, rerender } = renderHook(
      ({ companyId }: { companyId: string }) => useCustomer360(companyId),
      { initialProps: { companyId: COMPANY_A } },
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe("loading");
    });

    rerender({ companyId: COMPANY_B });

    await act(async () => {
      resolveB?.(readyModel(COMPANY_B, "Company B"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
      if (result.current.state.status === "ready") {
        expect(result.current.state.model.profile.data?.businessName).toBe("Company B");
      }
    });

    await act(async () => {
      resolveA?.(readyModel(COMPANY_A, "Company A"));
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status === "ready") {
      expect(result.current.state.model.identity.companyId).toBe(COMPANY_B);
      expect(result.current.state.model.profile.data?.businessName).toBe("Company B");
    }
  });
});
