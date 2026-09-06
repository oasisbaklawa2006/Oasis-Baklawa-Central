import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchCustomer360ReadModel } from "../customer360ReadModel";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

const companyRow = {
  id: VALID_UUID,
  business_name: "Acme Sweets",
  status: "active",
  phone: "+91 90000 00000",
  registered_address: "123 Market Road",
  gst_number: "29ABCDE1234F1Z5",
  account_manager_id: null,
  allow_credit: true,
  credit_limit: 100000,
  wallet_balance: 5000,
  current_balance: 0,
  total_outstanding: 12000,
  discount_percentage: 5,
  payment_terms: "NET30",
  price_tier: "B2B",
  created_at: "2026-01-01T00:00:00.000Z",
};

function createQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("fetchCustomer360ReadModel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "companies") {
        return createQuery({ data: companyRow, error: null }) as never;
      }
      if (table === "orders") {
        return createQuery({
          data: [{
            id: "order-1",
            order_number: "SO-1001",
            status: "confirmed",
            sales_order_value: 25000,
            created_at: "2026-02-01T00:00:00.000Z",
          }],
          error: null,
        }) as never;
      }
      if (table === "client_interactions") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "crm_tasks") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "support_tickets") {
        return createQuery({ data: [], error: null }) as never;
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("binds canonical company identity and authoritative slices", async () => {
    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(model.identity.companyId).toBe(VALID_UUID.toLowerCase());
    expect(model.profile.availability).toBe("available");
    expect(model.profile.data?.businessName).toBe("Acme Sweets");
    expect(model.orders.availability).toBe("available");
    expect(model.orders.data).toHaveLength(1);
    expect(model.branchesAndContacts.availability).toBe("unavailable_not_governed");
    expect(model.financeExposure.programmeOwner).toBe("POINT77");
  });

  it("marks CRM-lite slices as partial rather than canonical", async () => {
    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(model.interactions.availability).toBe("partial_crm_lite");
    expect(model.tasks.availability).toBe("partial_crm_lite");
  });
});
