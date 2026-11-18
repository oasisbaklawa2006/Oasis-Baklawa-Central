import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminGiftingEnquiries from "../AdminGiftingEnquiries";
import type { GiftingQueueRpcClient } from "@/lib/giftingEnquiries/queue";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const rawRow = (over: Record<string, unknown> = {}) => ({
  id: "22222222-2222-2222-2222-222222222222",
  kind: "wedding",
  name: "Synthetic Couple",
  company: null,
  email: "couple@example.invalid",
  phone: "+919999900000",
  message: "Favours for 150 guests",
  source: "wedding-page",
  marketing_consent: true,
  status: "received",
  receipt_count: 1,
  environment: "staging",
  first_received_at: "2026-11-19T09:00:00Z",
  last_received_at: "2026-11-19T09:00:00Z",
  status_changed_at: null,
  ...over,
});

type Reply = { data: unknown; error: { message?: string; code?: string } | null };

function makeClient(handler: (fn: string, args?: Record<string, unknown>) => Reply) {
  const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => handler(fn, args));
  return { rpc, client: { rpc } as unknown as GiftingQueueRpcClient };
}

describe("AdminGiftingEnquiries", () => {
  it("lists received enquiries by default with contact details and consent", async () => {
    const { rpc, client } = makeClient(() => ({ data: [rawRow()], error: null }));
    render(<AdminGiftingEnquiries client={client} />);
    expect(await screen.findByText("Synthetic Couple")).toBeTruthy();
    expect(screen.getByText("couple@example.invalid")).toBeTruthy();
    expect(screen.getByText("Marketing consent")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("gifting_enquiry_queue_list_v1", { p_status: "received", p_limit: 50, p_offset: 0 });
  });

  it("re-queries when the status filter changes", async () => {
    const { rpc, client } = makeClient(() => ({ data: [], error: null }));
    render(<AdminGiftingEnquiries client={client} />);
    await screen.findByText("No enquiries in this view.");
    fireEvent.click(screen.getByRole("button", { name: "Spam" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenLastCalledWith("gifting_enquiry_queue_list_v1", { p_status: "spam", p_limit: 50, p_offset: 0 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenLastCalledWith("gifting_enquiry_queue_list_v1", { p_status: null, p_limit: 50, p_offset: 0 }),
    );
  });

  it("triages an enquiry through the Core RPC and reloads the queue", async () => {
    let status = "received";
    const { rpc, client } = makeClient((fn) =>
      fn === "gifting_enquiry_queue_set_status_v1"
        ? ((status = "triaged"), { data: { id: "22222222-2222-2222-2222-222222222222", status, statusChangedAt: "2026-11-19T10:00:00Z" }, error: null })
        : { data: status === "received" ? [rawRow()] : [], error: null },
    );
    render(<AdminGiftingEnquiries client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: /Mark triaged: Synthetic Couple/ }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("gifting_enquiry_queue_set_status_v1", {
        p_enquiry_id: "22222222-2222-2222-2222-222222222222",
        p_status: "triaged",
      }),
    );
    expect(await screen.findByText("No enquiries in this view.")).toBeTruthy();
  });

  it("shows a role message for non-administrators and exposes no data", async () => {
    const { client } = makeClient(() => ({ data: null, error: { message: "GIFTING_QUEUE_FORBIDDEN", code: "42501" } }));
    render(<AdminGiftingEnquiries client={client} />);
    expect(await screen.findByText("Only administrators can view Gifting enquiries.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a retryable error without leaking backend detail", async () => {
    let calls = 0;
    const { client } = makeClient(() => {
      calls += 1;
      return calls === 1
        ? { data: null, error: { message: "relation gifting_enquiries failed at host db-internal", code: "XX000" } }
        : { data: [], error: null };
    });
    render(<AdminGiftingEnquiries client={client} />);
    expect(await screen.findByText("The enquiry queue is unavailable right now.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("db-internal");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No enquiries in this view.")).toBeTruthy();
  });

  it("keeps the row and reports failure when a status change is rejected", async () => {
    const { client } = makeClient((fn) =>
      fn === "gifting_enquiry_queue_set_status_v1"
        ? { data: null, error: { message: "GIFTING_QUEUE_FORBIDDEN", code: "42501" } }
        : { data: [rawRow()], error: null },
    );
    render(<AdminGiftingEnquiries client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: /Mark closed: Synthetic Couple/ }));
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You are not allowed to change enquiries."));
    expect(screen.getByText("Synthetic Couple")).toBeTruthy();
    // the busy state clears once the rejected change has settled
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Mark closed: Synthetic Couple/ }).hasAttribute("disabled")).toBe(false),
    );
  });
});
