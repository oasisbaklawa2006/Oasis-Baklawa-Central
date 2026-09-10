import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminClients from "../AdminClients";

/**
 * FAIL-485-001 — P1 UAT: after successful approval the pending tab list refreshed
 * but summary KPI cards (Pending Review / Recently Approved) stayed at mount-time
 * values. This suite reproduces the defect with controlled mock state only.
 */

const pendingApp = {
  id: "app-fail485001",
  business_name: "Mock B2B Applicant",
  trade_name: null,
  business_type: "retail",
  contact_person: "Test Contact",
  contact_email: "mock@example.test",
  mobile_number: "+919999999999",
  gst_number: null,
  expected_volume: "100kg",
  city: "Mumbai",
  state: "MH",
  registered_address: null,
  status: "pending",
  created_at: "2026-09-01T00:00:00.000Z",
  user_id: null,
  admin_notes: null,
  rejection_reason: null,
  assigned_price_tier: null,
};

type GovernanceSnapshot = { pending: number; approved: number; active: number };

let governanceSnapshot: GovernanceSnapshot;
let pendingApplications: typeof pendingApp[];
let approveRpcInvoked = false;
let governanceCountFetches = 0;

const rpcMock = vi.fn(async (_fn: string, _args?: Record<string, unknown>) => {
  if (_fn === "approve_b2b_trade_application_v1") {
    approveRpcInvoked = true;
    pendingApplications = [];
    governanceSnapshot = { pending: 0, approved: 5, active: 10 };
    return {
      data: [{ application_status: "approved", company_id: "company-fail485001" }],
      error: null,
    };
  }
  return { data: null, error: { message: `unexpected rpc ${_fn}` } };
});

function makeB2bApplicationsBuilder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    _head: false,
    _status: "pending",
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      builder._head = opts?.head === true;
      return builder;
    },
    eq: (_col: string, value: string) => {
      builder._status = value;
      if (builder._head) {
        governanceCountFetches += 1;
        const count =
          value === "pending"
            ? governanceSnapshot.pending
            : value === "approved"
              ? governanceSnapshot.approved
              : 0;
        return Promise.resolve({ count, error: null });
      }
      return builder;
    },
    order: () => {
      if (builder._head) {
        governanceCountFetches += 1;
        const count =
          builder._status === "pending"
            ? governanceSnapshot.pending
            : builder._status === "approved"
              ? governanceSnapshot.approved
              : 0;
        return Promise.resolve({ count, error: null });
      }
      if (builder._status === "pending") {
        return Promise.resolve({ data: pendingApplications, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    },
  };
  return builder;
}

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-fail485001" } }),
}));

vi.mock("@/utils/notifyEvent", () => ({
  notifyEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "pricing_slabs") {
        const chain = {
          select: () => chain,
          eq: () => Promise.resolve({ data: [{ id: "slab-1", slab_name: "Retail A" }], error: null }),
        };
        return chain;
      }
      if (table === "portal_access_invites") {
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }
      if (table === "users") {
        const chain = {
          select: () => chain,
          or: () => chain,
          eq: () =>
            Promise.resolve({
              data: [{ id: "mgr-1", full_name: "Account Manager", email: "mgr@example.test", role: "ADMIN", is_sales_executive: false }],
              error: null,
            }),
        };
        return chain;
      }
      if (table === "b2b_applications") {
        return makeB2bApplicationsBuilder();
      }
      if (table === "companies") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              governanceCountFetches += 1;
              return Promise.resolve({ count: governanceSnapshot.active, error: null });
            }
            return {
              order: () => Promise.resolve({ data: [], error: null }),
            };
          },
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      const fallback = {
        select: () => fallback,
        eq: () => fallback,
        order: () => Promise.resolve({ data: [], error: null }),
      };
      return fallback;
    },
    rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])),
  },
}));

function renderClients() {
  return render(
    <MemoryRouter>
      <AdminClients />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  governanceSnapshot = { pending: 1, approved: 4, active: 9 };
  pendingApplications = [pendingApp];
  approveRpcInvoked = false;
  governanceCountFetches = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FAIL-485-001 Admin Clients KPI convergence", () => {
  it("refetches governance counters after successful approval so KPI matches empty pending list", async () => {
    renderClients();

    await waitFor(() => {
      expect(screen.getByText("Pending Review").previousElementSibling).toHaveTextContent("1");
    });

    const mountTimeCountFetches = governanceCountFetches;
    expect(mountTimeCountFetches).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getAllByText("Mock B2B Applicant")[0]);

    const sheet = await screen.findByRole("dialog");
    const approveButton = within(sheet).getByRole("button", { name: /approve and activate/i });
    expect(approveButton).toBeDisabled();

    fireEvent.click(within(sheet).getByText(/select pricing slab/i));
    fireEvent.click(await screen.findByRole("option", { name: "Retail A" }));

    await waitFor(() => expect(approveButton).not.toBeDisabled());

    fireEvent.click(approveButton);

    await waitFor(() => expect(approveRpcInvoked).toBe(true));

    await waitFor(() => {
      expect(screen.getByText("Pending Review").previousElementSibling).toHaveTextContent("0");
      expect(screen.getByText("Recently Approved").previousElementSibling).toHaveTextContent("5");
      expect(screen.getByText("No pending applications")).toBeInTheDocument();
    });

    expect(governanceCountFetches).toBeGreaterThanOrEqual(mountTimeCountFetches + 3);
  });

  it("does not refetch governance counters when approval RPC fails", async () => {
    rpcMock.mockImplementationOnce(async () => ({
      data: null,
      error: { message: "rpc denied" },
    }));

    renderClients();

    await waitFor(() => {
      expect(screen.getByText("Pending Review").previousElementSibling).toHaveTextContent("1");
    });

    const countFetchesAfterMount = governanceCountFetches;

    fireEvent.click(screen.getAllByText("Mock B2B Applicant")[0]);
    const sheet = await screen.findByRole("dialog");

    fireEvent.click(within(sheet).getByText(/select pricing slab/i));
    fireEvent.click(await screen.findByRole("option", { name: "Retail A" }));

    fireEvent.click(within(sheet).getByRole("button", { name: /approve and activate/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalled());

    expect(screen.getByText("Pending Review").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Recently Approved").previousElementSibling).toHaveTextContent("4");
    expect(governanceCountFetches).toBe(countFetchesAfterMount);
    expect(screen.queryByText("No pending applications")).not.toBeInTheDocument();
  });
});
