import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { isAuthorizedForAdminPath } from "@/lib/appverse/routeAccess";
import { COMPLAINT_FINANCE_ROUTE, type ComplaintHandoff } from "@/lib/support/complaintBridge";
import AdminSupport, { FinanceComplaintLookup } from "../AdminSupport";

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  mfa: vi.fn(),
  verify: vi.fn(),
  role: "SUPPORT_EXECUTIVE",
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from, rpc: mock.rpc } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "staff-id" }, role: mock.role }) }));
vi.mock("@/lib/auth/mfaTotp", () => ({ readMfaState: mock.mfa, verifyTotpCode: mock.verify }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ticketId = "10000000-0000-4000-8000-000000000001";
const complaintId = "20000000-0000-4000-8000-000000000002";
const returnId = "30000000-0000-4000-8000-000000000003";
const adjustmentId = "40000000-0000-4000-8000-000000000004";
const walletEntryId = "50000000-0000-4000-8000-000000000005";
const resolutionRpc = "resolve_commercial_complaint_v1";
const linkRpc = "link_return_case_to_commercial_complaint_v1";
const handoffRpc = "get_commercial_complaint_handoff_facts_v1";

const ticket = {
  id: ticketId,
  order_id: "order-id",
  issue_type: "Order delivery enquiry",
  description: "Can you confirm the delivery?",
  status: "open",
  created_at: "2026-11-10T00:00:00Z",
};

const facts: ComplaintHandoff = {
  support_ticket_id: ticketId,
  ticket_order_id: "order-id",
  ticket_status: "open",
  complaint_id: complaintId,
  order_id: "order-id",
  company_id: "company-id",
  complaint_type: "DAMAGE",
  complaint_filed_at: "2026-11-10T00:00:00Z",
  complaint_deadline: "2026-11-20T12:00:00Z",
  complaint_status: "FILED",
  return_case_ids: [],
  adjustment_count: 0,
  adjustments: [],
  resolved: false,
};

let ticketRow: typeof ticket;
let handoffRow: ComplaintHandoff | null;
let handoffError: { message: string } | null;

beforeEach(() => {
  vi.resetAllMocks();
  mock.role = "SUPPORT_EXECUTIVE";
  ticketRow = { ...ticket };
  handoffRow = { ...facts };
  handoffError = null;
  mock.mfa.mockResolvedValue({ currentLevel: "aal2", verified: [] });
  mock.update.mockImplementation((patch: Partial<typeof ticket>) => ({
    eq: async () => {
      ticketRow = { ...ticketRow, ...patch };
      return { error: null };
    },
  }));
  mock.audit.mockResolvedValue({ error: null });
  mock.from.mockImplementation((relation: string) => {
    if (relation === "support_tickets") {
      return {
        select: () => ({ order: async () => ({ data: [ticketRow] }) }),
        update: mock.update,
      };
    }
    if (relation === "users") return { select: () => ({ not: async () => ({ data: [] }) }) };
    if (relation === "audit_logs") return { insert: mock.audit };
    throw new Error(`Unexpected table ${relation}`);
  });
  mock.rpc.mockImplementation((name: string) => {
    if (name === handoffRpc) return { maybeSingle: async () => ({ data: handoffRow, error: handoffError }) };
    throw new Error(`Unexpected RPC ${name}`);
  });
});

function mount(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <QueryClientProvider client={client}>{element}</QueryClientProvider>
  </MemoryRouter>);
}

async function expandTicket() {
  fireEvent.click(await screen.findByText(ticket.issue_type));
}

async function lookupAsFinance() {
  mock.role = "FINANCE_EXEC";
  mount(<FinanceComplaintLookup />);
  fireEvent.change(screen.getByLabelText("Support ticket ID from the handoff"), { target: { value: ticketId } });
  fireEvent.click(screen.getByRole("button", { name: "Find complaint" }));
  await screen.findByRole("region", { name: "Complaint handoff" });
}

function fillFinanceForm(remedy: string) {
  fireEvent.change(screen.getByLabelText("Remedy"), { target: { value: remedy } });
  fireEvent.change(screen.getByLabelText("Amount (INR)"), { target: { value: "150" } });
  fireEvent.change(screen.getByLabelText("Decision reason"), { target: { value: "Damaged on delivery" } });
  return screen.getByRole("button", { name: "Submit Finance resolution" });
}

describe("Central complaint bridge", () => {
  it("separates all four records and displays only the adjustment ID from persisted facts", async () => {
    ticketRow.status = "resolved";
    handoffRow = {
      ...facts,
      ticket_status: "resolved",
      return_case_ids: [returnId],
      adjustments: [{ adjustment_id: adjustmentId, adjustment_type: "REFUND_TO_WALLET", amount: 150, created_at: "2026-11-14T00:00:00Z" }],
      adjustment_count: 1,
      resolved: true,
      complaint_status: "RESOLVED",
    };
    mount(<AdminSupport />);
    fireEvent.click(await screen.findByRole("button", { name: "Closed tickets (1)" }));
    await expandTicket();

    const panel = within(await screen.findByRole("region", { name: "Complaint handoff" }));
    expect(mock.rpc).toHaveBeenCalledWith(handoffRpc, { p_support_ticket_id: ticketId });
    expect(panel.getByText(ticketId)).toBeInTheDocument();
    expect(panel.getByText("Support queue status · resolved")).toBeInTheDocument();
    expect(panel.getByText(complaintId)).toBeInTheDocument();
    expect(panel.getByText("Complaint status · RESOLVED")).toBeInTheDocument();
    expect(panel.getByText(/20 Nov 2026/)).toBeInTheDocument();
    expect(panel.getByText(returnId)).toBeInTheDocument();
    expect(panel.getByText(`Adjustment ID · ${adjustmentId}`)).toBeInTheDocument();
    expect(panel.queryByText(/Wallet entry ID/)).not.toBeInTheDocument();
  });

  it("keeps a raw closed ticket financially pending and Support unable to resolve it", async () => {
    ticketRow.status = "resolved";
    handoffRow = { ...facts, ticket_status: "resolved" };
    mount(<AdminSupport />);
    fireEvent.click(await screen.findByRole("button", { name: "Closed tickets (1)" }));
    await expandTicket();

    expect(await screen.findByText("Complaint status · FILED")).toBeInTheDocument();
    expect(screen.getByText("No Finance adjustment recorded")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Finance resolution" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Wallet entry ID/)).not.toBeInTheDocument();
    expect(mock.rpc).not.toHaveBeenCalledWith(resolutionRpc, expect.anything());
    expect(isAuthorizedForAdminPath(COMPLAINT_FINANCE_ROUTE, mock.role)).toBe(false);
    expect(isAuthorizedForAdminPath(COMPLAINT_FINANCE_ROUTE, "ADMIN")).toBe(false);
    expect(isAuthorizedForAdminPath(COMPLAINT_FINANCE_ROUTE, "FINANCE_EXEC")).toBe(true);
  });

  it("blocks raw status closure for a linked complaint and when handoff lookup fails", async () => {
    mount(<AdminSupport />);
    await expandTicket();
    await screen.findByRole("region", { name: "Complaint handoff" });
    expect(screen.queryByRole("button", { name: "Close support ticket" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(ticket.issue_type));
    handoffError = { message: "Unavailable" };
    await expandTicket();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not");
    expect(screen.queryByRole("button", { name: "Close support ticket" })).not.toBeInTheDocument();
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("preserves ordinary support ticket closure and audit", async () => {
    handoffRow = null;
    mount(<AdminSupport />);
    await expandTicket();
    fireEvent.click(await screen.findByRole("button", { name: "Close support ticket" }));
    await waitFor(() => expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({
      entity_id: ticketId,
      action_type: "resolve_support_ticket",
    })));
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "resolved", sla_resolved_at: expect.any(String),
    }));
    expect(await screen.findByRole("button", { name: "Closed tickets (1)" })).toBeInTheDocument();
    expect(mock.rpc).not.toHaveBeenCalledWith(resolutionRpc, expect.anything());
  });

  it("links a physical return via Core and refreshes the authoritative list", async () => {
    const read = mock.rpc.getMockImplementation();
    mock.rpc.mockImplementation((name: string) => {
      if (name !== linkRpc) return read?.(name);
      return { single: async () => {
        handoffRow = { ...facts, return_case_ids: [returnId] };
        return { data: { return_case_id: returnId, complaint_id: complaintId, already_linked: false }, error: null };
      } };
    });
    mount(<AdminSupport />);
    await expandTicket();
    fireEvent.change(await screen.findByLabelText("Physical return case ID"), { target: { value: returnId } });
    fireEvent.click(screen.getByRole("button", { name: "Link return case" }));
    expect(await screen.findByText(returnId)).toBeInTheDocument();
    expect(mock.rpc).toHaveBeenCalledWith(linkRpc, { p_return_case_id: returnId, p_complaint_id: complaintId });
    expect(mock.update).not.toHaveBeenCalled();
  });

  it.each([
    ["RETURN_COMPLAINT_LINEAGE_MISMATCH", /same order and company/],
    ["RETURN_CASE_UNBOUND_LEGACY", /legacy return case has no linked order/],
  ])("explains %s without recording a link", async (message, feedback) => {
    const read = mock.rpc.getMockImplementation();
    mock.rpc.mockImplementation((name: string) => name === linkRpc
      ? { single: async () => ({ data: null, error: { message } }) }
      : read?.(name));
    mount(<AdminSupport />);
    await expandTicket();
    fireEvent.change(await screen.findByLabelText("Physical return case ID"), { target: { value: returnId } });
    fireEvent.click(screen.getByRole("button", { name: "Link return case" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(feedback);
    expect(screen.getByText("No return case linked")).toBeInTheDocument();
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("requires credit-note document proof and bank-refund payment evidence", async () => {
    await lookupAsFinance();
    const submit = fillFinanceForm("CREDIT_NOTE");
    fireEvent.change(screen.getByLabelText("Tax document number"), { target: { value: "CN-01" } });
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/tax document number and its evidence reference/);
    fireEvent.change(screen.getByLabelText("Remedy"), { target: { value: "REFUND_TO_BANK" } });
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/bank payment reference/);
    expect(mock.rpc).not.toHaveBeenCalledWith(resolutionRpc, expect.anything());
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("requires AAL2 and shows the wallet entry ID returned by the Finance RPC", async () => {
    await lookupAsFinance();
    const read = mock.rpc.getMockImplementation();
    mock.rpc.mockImplementation((name: string) => name === resolutionRpc
      ? { single: async () => ({
          data: { adjustment_id: adjustmentId, wallet_entry_id: walletEntryId, already_resolved: false },
          error: null,
        }) }
      : read?.(name));
    mock.mfa.mockResolvedValueOnce({ currentLevel: "aal1", verified: [{ id: "factor-1", friendlyName: null }] });
    const submit = fillFinanceForm("REFUND_TO_WALLET");
    fireEvent.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(/verify your authenticator/i);
    expect(mock.rpc).not.toHaveBeenCalledWith(resolutionRpc, expect.anything());

    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify authenticator" }));
    await screen.findByText(/Authenticator verified/);
    expect(mock.verify).toHaveBeenCalledWith(expect.anything(), "factor-1", "123456");

    fireEvent.click(submit);
    expect(await screen.findByText(`Wallet entry ID · ${walletEntryId}`)).toBeInTheDocument();
    expect(mock.rpc).toHaveBeenCalledWith(resolutionRpc, {
      p_complaint_id: complaintId,
      p_adjustment_type: "REFUND_TO_WALLET",
      p_amount: 150,
      p_document_number: null,
      p_document_reference: null,
      p_payment_reference: null,
      p_decision_reason: "Damaged on delivery",
      p_correlation_id: expect.any(String),
      p_idempotency_key: expect.any(String),
    });
    expect(mock.from).not.toHaveBeenCalled();
  });
});
