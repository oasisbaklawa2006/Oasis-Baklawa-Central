import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const toastError = vi.fn();
const toastSuccess = vi.fn();
const recordDispatchProof = vi.fn();
const getFinanceExitFacts = vi.fn();

vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }) }));
vi.mock("@/lib/order-authority/gateExitAuthorityClient", () => ({
  recordB2bDispatchGateScan: vi.fn(),
  releaseB2bCartonAtDispatchGate: vi.fn(),
}));
vi.mock("@/lib/order-authority/financeExitAuthorityClient", () => ({
  recordDispatchProof: (...a: unknown[]) => recordDispatchProof(...a),
  getFinanceExitFacts: (...a: unknown[]) => getFinanceExitFacts(...a),
}));

// Scanning an already-released carton binds the order id without touching Core RPCs.
// A whitespace-only order id is truthy, so the proof button enables, but the
// evidenceOrder() preflight rejects it. This is the unhandled-rejection path.
vi.mock("@/integrations/supabase/client", () => {
  const cartons = {
    select: () => ({
      ilike: () => ({
        limit: async () => ({
          data: [{ id: "c1", carton_code: "CARTON-1", status: "handed_over", consignment_id: "k1" }],
          error: null,
        }),
      }),
    }),
  };
  const consignments = {
    select: () => ({
      eq: () => ({
        single: async () => ({ data: { order_id: "   ", consignment_number: "CN-1", status: "x" }, error: null }),
      }),
    }),
  };
  return { supabase: { from: (table: string) => (table === "b2b_dispatch_cartons" ? cartons : consignments) } };
});

import AdminB2bSecurityGate from "../AdminB2bSecurityGate";

describe("AdminB2bSecurityGate dispatch-proof preflight", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    recordDispatchProof.mockReset();
    getFinanceExitFacts.mockReset();
  });

  it("shows the preflight error, writes nothing and re-enables the button when evidenceOrder() throws", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    try {
      render(<AdminB2bSecurityGate />);
      const scanner = screen.getByTestId("macro-security-gate-scanner");
      fireEvent.change(scanner, { target: { value: "CARTON-1" } });
      fireEvent.submit(scanner.closest("form")!);
      const button = (await screen.findByRole("button", { name: /Freeze dispatch proof/i })) as HTMLButtonElement;
      await waitFor(() => expect(button.disabled).toBe(false));

      fireEvent.change(screen.getByPlaceholderText("Gate/departure evidence refs, comma separated"), {
        target: { value: "gate-photo-1" },
      });
      fireEvent.click(button);

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("Scan a governed B2B carton before freezing proof"),
      );
      expect(recordDispatchProof).not.toHaveBeenCalled();
      expect(getFinanceExitFacts).not.toHaveBeenCalled();
      expect(toastSuccess).not.toHaveBeenCalled();
      await waitFor(() => expect(button.disabled).toBe(false));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      window.removeEventListener("unhandledrejection", onUnhandled);
    }
  });
});
