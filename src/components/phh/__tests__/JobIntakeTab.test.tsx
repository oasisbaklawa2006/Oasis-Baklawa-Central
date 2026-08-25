import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JobIntakeTab from "../JobIntakeTab";
import type { ProductionJob } from "../types";

// Certification coverage: accept_production_job and reject_production_job
// had zero existing test coverage anywhere in the repo.

const job: ProductionJob = {
  id: "job-1",
  order_item_id: null,
  order_id: "order-1",
  product_id: "prod-1",
  department: "ARABIC_SWEETS",
  assigned_to: null,
  assigned_qty: 6,
  produced_qty: 0,
  wasted_qty: 0,
  net_weight_per_unit: 0,
  batch_number: null,
  priority: "normal",
  stage: "prep",
  status: "pending",
  rejection_reason: null,
  started_at: null,
  completed_at: null,
  locked: false,
  created_at: null,
  updated_at: null,
  product: { name: "Test Sweet", image_url: null, sku: "SKU-1" },
};

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("JobIntakeTab accept", () => {
  it("calls accept_production_job with a generated batch number and correlation id", async () => {
    const onRefresh = vi.fn();
    render(<JobIntakeTab jobs={[job]} userId="user-1" onRefresh={onRefresh} />);
    fireEvent.click(screen.getByText("Accept Job"));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("accept_production_job", {
        p_job_id: "job-1",
        p_batch_number: expect.any(String),
        p_correlation_id: expect.any(String),
      }),
    );
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("does not fire a second accept RPC while the first is in flight (idempotency guard)", async () => {
    let resolveRpc: (value: { data: null; error: null }) => void = () => {};
    rpcMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRpc = resolve; }));
    render(<JobIntakeTab jobs={[job]} userId="user-1" onRefresh={vi.fn()} />);
    const acceptButton = screen.getByText("Accept Job");
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton.closest("button")!);

    resolveRpc({ data: null, error: null });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
  });

  it("surfaces an accept_production_job RPC error via toast", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Already accepted" } });
    const { toast } = await import("sonner");
    render(<JobIntakeTab jobs={[job]} userId="user-1" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText("Accept Job"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Already accepted"));
  });
});

describe("JobIntakeTab reject", () => {
  it("requires a rejection reason before calling reject_production_job", async () => {
    render(<JobIntakeTab jobs={[job]} userId="user-1" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "" })); // the XCircle reject-open button has no text
    fireEvent.click(screen.getByText("Confirm Reject"));

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls reject_production_job with the job id and entered reason", async () => {
    const onRefresh = vi.fn();
    render(<JobIntakeTab jobs={[job]} userId="user-1" onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: "" }));
    fireEvent.change(screen.getByPlaceholderText("Reason for rejection (required)..."), {
      target: { value: "Wrong SKU assigned" },
    });
    fireEvent.click(screen.getByText("Confirm Reject"));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("reject_production_job", {
        p_job_id: "job-1",
        p_rejection_reason: "Wrong SKU assigned",
        p_correlation_id: expect.any(String),
      }),
    );
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });
});
