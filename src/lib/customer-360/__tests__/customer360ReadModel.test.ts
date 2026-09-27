import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  CLIENT_INTERACTION_LEDGER_SELECT,
  CUSTOMER360_COMMUNICATION_HISTORY_LIMIT,
} from "@/lib/crm-communication-history/crmCommunicationHistoryTypes";
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

type QueryCalls = {
  in?: Array<{ column: string; values: readonly unknown[] }>;
  select?: string;
  limit?: number;
};

function createQuery(
  result: { data: unknown; error: unknown },
  calls?: QueryCalls,
  eqCalls?: Array<{ column: string; value: unknown }>,
) {
  const builder: Record<string, unknown> = {
    select: vi.fn((columns: string) => {
      if (calls) calls.select = columns;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls?.push({ column, value });
      return builder;
    }),
    not: vi.fn(() => builder),
    in: vi.fn((column: string, values: readonly unknown[]) => {
      calls?.in?.push({ column, values });
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn((value: number) => {
      if (calls) calls.limit = value;
      return builder;
    }),
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

vi.mock("@/lib/order-authority/creditWalletAuthorityClient", () => ({
  getWalletBalance: vi.fn(async () => 7500),
}));

describe("fetchCustomer360ReadModel", () => {
  let ticketQueryCalls: QueryCalls;
  let interactionsQueryCalls: QueryCalls;

  beforeEach(async () => {
    vi.clearAllMocks();
    ticketQueryCalls = { in: [] };
    interactionsQueryCalls = {};
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
        return createQuery({ data: [], error: null }, interactionsQueryCalls) as never;
      }
      if (table === "crm_tasks") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "delivery_addresses") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "sales_order_drafts") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "support_tickets") {
        return createQuery({
          data: [{
            id: "ticket-1",
            order_id: "order-1",
            issue_type: "quality",
            status: "open",
            created_at: "2026-02-02T00:00:00.000Z",
            order: { company_id: VALID_UUID, order_number: "SO-1001" },
          }],
          error: null,
        }, ticketQueryCalls) as never;
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
    expect(model.branchesAndContacts.availability).toBe("available");
    expect(model.financeExposure.availability).toBe("available");
    expect(model.customerHealth.availability).toBe("available");
    expect(model.whatsappOrderLinkage.availability).toBe("available");
    expect(model.financeExposure.programmeOwner).toBe("POINT77");
  });

  it("marks CRM-lite slices as partial rather than canonical", async () => {
    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(model.interactions.availability).toBe("partial_crm_lite");
    expect(model.interactions.reason).toContain("communicationsLedger");
    expect(model.tasks.availability).toBe("partial_crm_lite");
    expect(model.communicationsLedger.availability).toBe("available");
    expect(model.communicationsLedger.programmeOwner).toBe("POINT61");
    expect(model.communicationsLedger.data?.entries).toEqual([]);
    expect(model.communicationsLedger.data?.recordLimit).toBe(CUSTOMER360_COMMUNICATION_HISTORY_LIMIT);
  });

  it("selects company_id and executive_id for communications ledger normalization", async () => {
    await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(interactionsQueryCalls.select).toBe(CLIENT_INTERACTION_LEDGER_SELECT);
    expect(interactionsQueryCalls.select).toContain("company_id");
    expect(interactionsQueryCalls.select).toContain("executive_id");
    expect(interactionsQueryCalls.limit).toBe(CUSTOMER360_COMMUNICATION_HISTORY_LIMIT);
  });

  it("populates communications ledger entries when interaction rows include company_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "companies") {
        return createQuery({ data: companyRow, error: null }) as never;
      }
      if (table === "orders") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "client_interactions") {
        return createQuery({
          data: [{
            id: "ci-1",
            company_id: VALID_UUID,
            executive_id: "exec-1",
            interaction_type: "call",
            notes: "Follow-up call",
            outcome: null,
            follow_up_date: null,
            created_at: "2026-03-01T10:00:00.000Z",
          }],
          error: null,
        }, interactionsQueryCalls) as never;
      }
      if (table === "crm_tasks") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "delivery_addresses") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "sales_order_drafts") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "support_tickets") {
        return createQuery({ data: [], error: null }) as never;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(model.communicationsLedger.data?.entries).toHaveLength(1);
    expect(model.communicationsLedger.data?.entries[0]?.channel).toBe("call");
    expect(model.communicationsLedger.data?.entries[0]?.actor.executiveId).toBe("exec-1");
  });

  it("scopes support tickets to the company order set before applying the limit", async () => {
    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(ticketQueryCalls.in).toEqual([{ column: "order_id", values: ["order-1"] }]);
    expect(model.tickets.data).toHaveLength(1);
    expect(model.tickets.data?.[0]?.orderId).toBe("order-1");
  });

  it("returns no ticket query when the company has no scoped orders", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "companies") {
        return createQuery({ data: companyRow, error: null }) as never;
      }
      if (table === "orders") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "client_interactions" || table === "crm_tasks" || table === "delivery_addresses" || table === "sales_order_drafts") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "support_tickets") {
        throw new Error("support_tickets should not be queried without company order ids");
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(model.tickets.data).toEqual([]);
  });

  it("uses PF-6B wallet balance when available", async () => {
    const { getWalletBalance } = await import("@/lib/order-authority/creditWalletAuthorityClient");
    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });
    expect(getWalletBalance).toHaveBeenCalledWith(VALID_UUID.toLowerCase());
    expect(model.profile.data?.walletBalance).toBe(7500);
  });

  it("scopes interactions and tasks to the signed-in sales executive", async () => {
    const interactionEqCalls: Array<{ column: string; value: unknown }> = [];
    const taskEqCalls: Array<{ column: string; value: unknown }> = [];
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "companies") {
        return createQuery({
          data: { ...companyRow, account_manager_id: "sales-exec-1" },
          error: null,
        }) as never;
      }
      if (table === "orders") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "client_interactions") {
        return createQuery({ data: [], error: null }, interactionsQueryCalls, interactionEqCalls) as never;
      }
      if (table === "crm_tasks") {
        return createQuery({ data: [], error: null }, undefined, taskEqCalls) as never;
      }
      if (table === "delivery_addresses" || table === "sales_order_drafts") {
        return createQuery({ data: [], error: null }) as never;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
      isSalesExecutiveViewer: true,
      viewerUserId: "sales-exec-1",
    });

    expect(interactionEqCalls).toContainEqual({ column: "executive_id", value: "sales-exec-1" });
    expect(taskEqCalls).toContainEqual({ column: "sales_exec_id", value: "sales-exec-1" });
  });

  it("withholds customer health when CRM-lite source slices fail", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "companies") {
        return createQuery({ data: companyRow, error: null }) as never;
      }
      if (table === "orders") {
        return createQuery({ data: [], error: null }) as never;
      }
      if (table === "client_interactions") {
        return createQuery({ data: null, error: { message: "rls denied" } }) as never;
      }
      if (table === "crm_tasks" || table === "delivery_addresses" || table === "sales_order_drafts") {
        return createQuery({ data: [], error: null }) as never;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const model = await fetchCustomer360ReadModel(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(model.customerHealth.availability).toBe("error");
    expect(model.customerHealth.errorMessage).toContain("health signals are withheld");
  });
});
