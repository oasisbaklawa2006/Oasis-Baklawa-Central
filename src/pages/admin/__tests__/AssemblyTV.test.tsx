import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AssemblyTV from "../AssemblyTV";

const fetchJobsMock = vi.fn();
const fetchProductsMock = vi.fn();

vi.mock("@/lib/assembly/assemblyJobReadBoundary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/assembly/assemblyJobReadBoundary")>();
  return {
    ...actual,
    fetchAssemblyJobsForTv: (...args: unknown[]) => fetchJobsMock(...args),
    fetchProductNamesForAssemblyTv: (...args: unknown[]) => fetchProductsMock(...args),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AssemblyTV read-only canonical boundary", () => {
  it("renders governed assembly jobs without any mutation controls", async () => {
    fetchJobsMock.mockResolvedValue([
      {
        id: "job-1",
        assembly_job_number: "ASM-SO100-A1B2C3D4",
        order_id: "order-abc-12345678",
        output_product_id: "prod-1",
        output_sku: "HAMPER-1",
        planned_qty: 10,
        completed_qty: 6,
        accepted_qty: 0,
        rejected_qty: 0,
        status: "in_progress",
        created_at: "2026-08-22T00:00:00.000Z",
      },
      {
        id: "job-2",
        assembly_job_number: "ASM-SO100-E5F6G7H8",
        order_id: "order-abc-12345678",
        output_product_id: "prod-2",
        output_sku: "GIFT-2",
        planned_qty: 5,
        completed_qty: 5,
        accepted_qty: 5,
        rejected_qty: 0,
        status: "accepted",
        created_at: "2026-08-22T01:00:00.000Z",
      },
    ]);
    fetchProductsMock.mockResolvedValue({
      "prod-1": { name: "Festive Hamper", sku: "HAMPER-1" },
      "prod-2": { name: "Gift Box", sku: "GIFT-2" },
    });

    render(<AssemblyTV />);

    expect(await screen.findByText("Festive Hamper")).toBeTruthy();
    expect(screen.getByText("Gift Box")).toBeTruthy();
    expect(screen.getByText(/Read-only · governed b2b_assembly_jobs authority/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(fetchJobsMock).toHaveBeenCalled();
    expect(fetchProductsMock).toHaveBeenCalledWith(["prod-1", "prod-2"]);
  });

  it("clears the board and surfaces an error when the governed read fails", async () => {
    fetchJobsMock.mockRejectedValue(new Error("RLS denied"));
    fetchProductsMock.mockResolvedValue({});

    render(<AssemblyTV />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load assembly jobs: RLS denied/i)).toBeTruthy();
    });
    expect(screen.queryByText("Festive Hamper")).toBeNull();
  });
});
