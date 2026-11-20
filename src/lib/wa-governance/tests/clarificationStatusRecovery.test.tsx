import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SuggestedOrdersTab from "@/components/warroom/SuggestedOrdersTab";
import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppMessage } from "@/utils/whatsapp";
import { toast } from "sonner";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/utils/whatsapp", () => ({ sendWhatsAppMessage: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "wa-operator" } }) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const sampleRow = {
  id: "acceptance-recovery-test-id",
  created_at: "2026-11-18T09:00:00Z",
  sender_phone: "919876543210",
  sender_name: "Test customer",
  extracted_business_name: "Test customer",
  extracted_items: [{ product_name: "Baklava", quantity: null, unit: null, notes: "ambiguous" }],
  extracted_delivery_date: null,
  extracted_notes: null,
  ai_confidence: 0.5,
  ai_model: null,
  source_image_url: null,
  source_text: "Need baklava",
  matched_company_id: null,
  shadow_client_id: null,
  promoted_order_id: null,
  rejection_reason: null,
  status: "pending_review",
};

const statusUpdate = vi.fn();
const updateEq = vi.fn().mockReturnThis();
const updateSelect = vi.fn(() => statusUpdate());

function showSuggestions() {
  return render(createElement(MemoryRouter, null,
    createElement(SuggestedOrdersTab, { activeCompanies: [] }),
  ));
}

beforeEach(() => {
  vi.resetAllMocks();
  updateEq.mockReturnThis();
  updateSelect.mockImplementation(() => statusUpdate());
  vi.mocked(supabase.from).mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [sampleRow], error: null }),
    update: vi.fn(() => ({ eq: updateEq, select: updateSelect })),
  }) as unknown as ReturnType<typeof supabase.from>);
});

afterEach(cleanup);

describe("WA-100 accepted clarification status-only recovery", () => {
  it("retries the database transition after acceptance without another WhatsApp send, even after remount", async () => {
    statusUpdate
      .mockResolvedValueOnce({ data: null, error: { message: "Write temporarily unavailable" } })
      .mockResolvedValueOnce({ data: [{ id: sampleRow.id, status: "needs_clarification" }], error: null });
    vi.mocked(sendWhatsAppMessage).mockResolvedValue({ success: true });

    showSuggestions();
    fireEvent.click(await screen.findByRole("button", { name: "Request Clarification" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Send" }));

    await waitFor(() => expect(statusUpdate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Retry the status update only")));
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);

    cleanup();
    showSuggestions();
    fireEvent.click(await screen.findByRole("button", { name: "Retry status update only" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Retry status update only" }).at(-1)!);

    await waitFor(() => expect(statusUpdate).toHaveBeenCalledTimes(2));
    expect(updateEq).toHaveBeenCalledWith("status", "pending_review");
    expect(updateSelect).toHaveBeenCalledWith("id, status");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("suggestion updated")));
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps the exact accepted text, fails closed on zero rows and never resends on status recovery", async () => {
    statusUpdate.mockResolvedValue({ data: [], error: null });
    vi.mocked(sendWhatsAppMessage).mockResolvedValue({ success: true });
    // Use a distinct identity: the module-scoped accepted-message map deliberately
    // survives remount and must not bleed across unrelated test scenarios.
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ ...sampleRow, id: "accepted-text-recovery-test-id" }], error: null }),
      update: vi.fn(() => ({ eq: updateEq, select: updateSelect })),
    }) as unknown as ReturnType<typeof supabase.from>);

    showSuggestions();
    fireEvent.click(await screen.findByRole("button", { name: "Request Clarification" }));
    const editable = screen.getByRole("textbox");
    fireEvent.change(editable, { target: { value: "CUSTOM ACCEPTED MESSAGE FOR TEST" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Send" }));

    await waitFor(() => expect(statusUpdate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("already changed or is unavailable")));
    expect(toast.success).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(expect.objectContaining({
      message: "CUSTOM ACCEPTED MESSAGE FOR TEST",
    }));

    cleanup();
    showSuggestions();
    fireEvent.click(await screen.findByRole("button", { name: "Retry status update only" }));
    expect(screen.getByRole("textbox")).toHaveValue("CUSTOM ACCEPTED MESSAGE FOR TEST");
    expect(screen.getByRole("textbox")).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Retry status update only" }).at(-1)!);
    await waitFor(() => expect(statusUpdate).toHaveBeenCalledTimes(2));
    expect(toast.success).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
  });

  it("blocks a second send when a tab remounts before the first provider result", async () => {
    const gate: { resolve?: (result: { success: false; acceptanceUnknown: true; error: string }) => void } = {};
    vi.mocked(sendWhatsAppMessage).mockImplementation(() => new Promise((resolve) => {
      gate.resolve = resolve;
    }));
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ ...sampleRow, id: "remount-before-result-id" }], error: null }),
      update: vi.fn(() => ({ eq: updateEq, select: updateSelect })),
    }) as unknown as ReturnType<typeof supabase.from>);

    showSuggestions();
    fireEvent.click(await screen.findByRole("button", { name: "Request Clarification" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Send" }));
    await waitFor(() => expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1));

    cleanup();
    showSuggestions();
    fireEvent.click(await screen.findByRole("button", { name: "Request Clarification" }));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("still in progress"));
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);

    gate.resolve?.({ success: false, acceptanceUnknown: true, error: "ACCEPTANCE_UNKNOWN" });
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("acceptance is unconfirmed")));
    fireEvent.click(screen.getByRole("button", { name: "Request Clarification" }));
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(statusUpdate).not.toHaveBeenCalled();
  });

  it("does not allow a status-only recovery when provider acceptance was unknown", async () => {
    statusUpdate.mockResolvedValue({ data: [], error: null });
    vi.mocked(sendWhatsAppMessage).mockResolvedValue({
      success: false, acceptanceUnknown: true, error: "ACCEPTANCE_UNKNOWN",
    });

    // Different suggestion identity from the confirmed-acceptance test above.
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ ...sampleRow, id: "unknown-acceptance-test-id" }], error: null }),
      update: vi.fn(() => ({ eq: updateEq, select: updateSelect })),
    }) as unknown as ReturnType<typeof supabase.from>);

    showSuggestions();
    fireEvent.click(await screen.findByRole("button", { name: "Request Clarification" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Send" }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("acceptance is unconfirmed")));
    expect(statusUpdate).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
  });
});
