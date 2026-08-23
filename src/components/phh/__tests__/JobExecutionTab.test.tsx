import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JobExecutionTab from "../JobExecutionTab";
import type { ProductionJob } from "../types";

const job: ProductionJob = {
  id: "job-1",
  order_item_id: null,
  order_id: "order-1",
  product_id: "prod-1",
  department: "ARABIC_SWEETS",
  assigned_to: null,
  assigned_qty: 10,
  produced_qty: 0,
  wasted_qty: 0,
  net_weight_per_unit: 0,
  batch_number: "B-1",
  priority: "normal",
  stage: "prep",
  status: "in_production",
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

let openIssuesResult: unknown[] = [];

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.then = (resolve: (value: { data: unknown[] }) => void) =>
        resolve(relation === "production_issues" ? { data: openIssuesResult } : { data: [] });
      return builder;
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  openIssuesResult = [];
});

function openIssueModal() {
  render(<JobExecutionTab jobs={[job]} userId="user-1" department="ARABIC_SWEETS" onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByText("Test Sweet"));
  fireEvent.click(screen.getByText("Report Issue"));
}

describe("JobExecutionTab governed issue reporting", () => {
  it("calls report_production_issue with the job, department and issue details", async () => {
    openIssueModal();
    fireEvent.change(screen.getByPlaceholderText("Describe the issue..."), { target: { value: "Mixer is jammed" } });
    fireEvent.click(screen.getByText("Submit Issue"));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("report_production_issue", expect.objectContaining({
      p_job_id: "job-1",
      p_department: "ARABIC_SWEETS",
      p_issue_type: "material",
      p_comment: "Mixer is jammed",
      p_correlation_id: expect.any(String),
    })));
  });

  it("does not submit without issue text", () => {
    openIssueModal();
    fireEvent.click(screen.getByText("Submit Issue"));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces an RPC error via toast without closing the modal", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Not authorised" } });
    openIssueModal();
    fireEvent.change(screen.getByPlaceholderText("Describe the issue..."), { target: { value: "Mixer is jammed" } });
    fireEvent.click(screen.getByText("Submit Issue"));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Submit Issue")).toBeTruthy();
  });

  it("shows a success toast and closes the modal on a successful report", async () => {
    const { toast } = await import("sonner");
    openIssueModal();
    fireEvent.change(screen.getByPlaceholderText("Describe the issue..."), { target: { value: "Mixer is jammed" } });
    fireEvent.click(screen.getByText("Submit Issue"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("⚠️ Issue Reported"));
    expect(screen.queryByPlaceholderText("Describe the issue...")).toBeNull();
  });

  it("does not allow a second submit while the first report is in flight", async () => {
    let resolveRpc: (value: { data: null; error: null }) => void = () => {};
    rpcMock.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRpc = resolve; })
    );
    openIssueModal();
    fireEvent.change(screen.getByPlaceholderText("Describe the issue..."), { target: { value: "Mixer is jammed" } });
    const submitButton = screen.getByText("Submit Issue");
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    resolveRpc({ data: null, error: null });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
  });

  it("disables Pause Production while a report is in flight, preventing an overlapping RPC", async () => {
    let resolveRpc: (value: { data: null; error: null }) => void = () => {};
    rpcMock.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRpc = resolve; })
    );
    openIssueModal();
    fireEvent.change(screen.getByPlaceholderText("Describe the issue..."), { target: { value: "Mixer is jammed" } });
    fireEvent.click(screen.getByText("Submit Issue"));

    expect(screen.getByText("Pause Production")).toBeDisabled();

    resolveRpc({ data: null, error: null });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Pause Production")).not.toBeDisabled();
  });
});

describe("JobExecutionTab governed issue resolution", () => {
  const openIssue = { id: "issue-1", job_id: "job-1", issue_type: "machine", comment: "Mixer is jammed", created_at: "2026-08-23T00:00:00.000Z" };

  it("shows no open-issues section when the job has none", async () => {
    render(<JobExecutionTab jobs={[job]} userId="user-1" department="ARABIC_SWEETS" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText("Test Sweet"));
    await waitFor(() => expect(screen.queryByText("Open issues on this job")).toBeNull());
  });

  it("displays an open issue for the selected job and blocks resolving without notes", async () => {
    openIssuesResult = [openIssue];
    render(<JobExecutionTab jobs={[job]} userId="user-1" department="ARABIC_SWEETS" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText("Test Sweet"));

    expect(await screen.findByText("Mixer is jammed")).toBeTruthy();
    fireEvent.click(screen.getByText("Mark Resolved"));
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("calls resolve_production_issue with the entered resolution notes", async () => {
    openIssuesResult = [openIssue];
    render(<JobExecutionTab jobs={[job]} userId="user-1" department="ARABIC_SWEETS" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText("Test Sweet"));

    await screen.findByText("Mixer is jammed");
    fireEvent.change(screen.getByPlaceholderText("Resolution notes (what fixed it)..."), { target: { value: "Replaced belt" } });
    fireEvent.click(screen.getByText("Mark Resolved"));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("resolve_production_issue", {
      p_issue_id: "issue-1",
      p_resolution_notes: "Replaced belt",
    }));
  });

  it("removes the issue from the list on a successful resolution", async () => {
    openIssuesResult = [openIssue];
    render(<JobExecutionTab jobs={[job]} userId="user-1" department="ARABIC_SWEETS" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText("Test Sweet"));

    await screen.findByText("Mixer is jammed");
    fireEvent.change(screen.getByPlaceholderText("Resolution notes (what fixed it)..."), { target: { value: "Replaced belt" } });
    fireEvent.click(screen.getByText("Mark Resolved"));

    await waitFor(() => expect(screen.queryByText("Mixer is jammed")).toBeNull());
  });
});
