import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShadowClientSection from "@/components/warroom/ShadowClientSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const company = {
  id: "shadow-company-id",
  business_name: "Test Bakery (WhatsApp)",
  phone: "+919876543210",
  gst_number: "WA:919876543210",
  fssai_number: null,
  registered_address: null,
  created_at: null,
};
const onRefresh = vi.fn();
let updateError: unknown;

beforeEach(() => {
  vi.resetAllMocks();
  updateError = null;
  vi.mocked(supabase.from).mockImplementation(() => {
    const result = Promise.resolve({ data: [], error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: updateError }) })),
      then: result.then.bind(result),
    };
    return query as unknown as ReturnType<typeof supabase.from>;
  });
});
afterEach(cleanup);

async function openTriage() {
  render(createElement(MemoryRouter, null,
    createElement(ShadowClientSection, { companies: [company], onRefresh }),
  ));
  fireEvent.click(screen.getByRole("button", { name: "Triage" }));
  await screen.findByText("New Lead — No WhatsApp history detected for this number.");
}

describe("WA-100 Shadow Client approval and draft handoff", () => {
  it.each([
    { name: "an RPC error", data: null, error: { message: "Approval unavailable" }, message: "Approval unavailable" },
    { name: "an RPC error even with an ID", data: "application-id", error: { message: "Approval failed" }, message: "Approval failed" },
    { name: "no application ID", data: null, error: null, message: "Client Governance did not return an application ID." },
    { name: "an empty application ID", data: "", error: null, message: "Client Governance did not return an application ID." },
  ])("does not announce success for $name", async ({ data, error, message }) => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data, error } as Awaited<ReturnType<typeof supabase.rpc>>);
    await openTriage();
    fireEvent.click(screen.getByRole("button", { name: "Queue Client for Approval" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`Operation failed: ${message}`));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Queue Client for Approval" })).toBeEnabled();
  });

  it("queues the selected company and announces success only after the RPC returns an ID", async () => {
    let resolveRequest!: (value: unknown) => void;
    vi.mocked(supabase.rpc).mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }) as unknown as ReturnType<typeof supabase.rpc>);
    await openTriage();
    expect(screen.getByRole("link", { name: "Operator Inbox" })).toHaveAttribute("href", "/admin/operator-inbox");
    expect(screen.getByText(/confirm the customer and order lines/)).toHaveTextContent("If only debug history is available");
    vi.mocked(supabase.from).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Queue Client for Approval" }));

    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("queue_whatsapp_shadow_client_for_approval_v1", {
      p_company_id: company.id,
      p_business_name: "Test Bakery",
      p_gst_number: null,
      p_fssai_number: null,
      p_registered_address: null,
    });
    expect(toast.success).not.toHaveBeenCalled();
    resolveRequest({ data: "application-id", error: null });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Client queued for approval in Client Governance."));
    expect(toast.info).toHaveBeenCalledWith("No sales-order draft was created. No WhatsApp message was sent.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it.each([
    { error: new Error("Update failed"), message: "Update failed" },
    { error: { message: "Permission denied" }, message: "Permission denied" },
    { error: { message: "" }, message: "Unknown error" },
    { error: { message: "  " }, message: "Unknown error" },
    { error: { message: 42 }, message: "Unknown error" },
    { error: {}, message: "Unknown error" },
    { error: "Unexpected response", message: "Unknown error" },
  ])("reports Spam/Other update failure: $message", async ({ error, message }) => {
    updateError = error;
    await openTriage();
    fireEvent.click(screen.getByRole("button", { name: "Spam/Other" }));
    fireEvent.click(screen.getByRole("button", { name: /Archive as Spam/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`Operation failed: ${message}`));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
