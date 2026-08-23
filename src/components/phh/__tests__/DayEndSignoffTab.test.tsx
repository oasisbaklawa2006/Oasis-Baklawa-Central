import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DayEndSignoffTab from "../DayEndSignoffTab";

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

let currentSignoff: Record<string, unknown> | null = null;

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = () => Promise.resolve({ data: currentSignoff, error: null });
      return builder;
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  currentSignoff = null;
});

describe("DayEndSignoffTab", () => {
  it("shows a submission form when no signoff exists for today", async () => {
    render(<DayEndSignoffTab department="ARABIC_SWEETS" userId="user-1" />);
    expect(await screen.findByText("Submit Day-End Signoff")).toBeTruthy();
  });

  it("submits a fresh signoff with department, business date, and exception notes", async () => {
    render(<DayEndSignoffTab department="ARABIC_SWEETS" userId="user-1" />);
    const button = await screen.findByText("Submit Day-End Signoff");
    fireEvent.change(screen.getByPlaceholderText("Exception notes (optional)..."), { target: { value: "Late start" } });
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("submit_production_day_end", expect.objectContaining({
      p_department: "ARABIC_SWEETS",
      p_exception_notes: "Late start",
      p_corrects_signoff_id: null,
      p_correlation_id: expect.any(String),
    })));
  });

  it("shows the signed summary when a signoff already exists for today", async () => {
    currentSignoff = {
      id: "sign-1",
      department: "ARABIC_SWEETS",
      business_date: "2026-08-23",
      summary: { opening_pending_jobs: 3, quantity_produced_today: 120 },
      exception_notes: null,
      signed_by: "user-1",
      signed_at: "2026-08-23T18:00:00.000Z",
      corrects_signoff_id: null,
    };
    render(<DayEndSignoffTab department="ARABIC_SWEETS" userId="user-1" />);
    expect(await screen.findByText("Signed for 2026-08-23")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
  });

  it("submits a correction referencing the existing signoff id", async () => {
    currentSignoff = {
      id: "sign-1",
      department: "ARABIC_SWEETS",
      business_date: "2026-08-23",
      summary: { opening_pending_jobs: 3 },
      exception_notes: null,
      signed_by: "user-1",
      signed_at: "2026-08-23T18:00:00.000Z",
      corrects_signoff_id: null,
    };
    render(<DayEndSignoffTab department="ARABIC_SWEETS" userId="user-1" />);
    fireEvent.click(await screen.findByText("Submit a correction"));
    fireEvent.change(screen.getByPlaceholderText("Why is this being corrected?"), { target: { value: "Miscounted output" } });
    fireEvent.click(screen.getByText("Submit Correction"));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("submit_production_day_end", expect.objectContaining({
      p_department: "ARABIC_SWEETS",
      p_exception_notes: "Miscounted output",
      p_corrects_signoff_id: "sign-1",
    })));
  });

  it("blocks a correction submission with no notes entered", async () => {
    currentSignoff = {
      id: "sign-1",
      department: "ARABIC_SWEETS",
      business_date: "2026-08-23",
      summary: {},
      exception_notes: null,
      signed_by: "user-1",
      signed_at: "2026-08-23T18:00:00.000Z",
      corrects_signoff_id: null,
    };
    render(<DayEndSignoffTab department="ARABIC_SWEETS" userId="user-1" />);
    fireEvent.click(await screen.findByText("Submit a correction"));
    expect(screen.getByText("Submit Correction")).toBeDisabled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
