import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AssemblyQcPanel, { canRecordAssemblyQcGate } from "../AssemblyQcPanel";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({
          data: null,
          error: relation === "assembly_qc_commissioning_v1"
            ? { message: "permission denied for table assembly_qc_commissioning_v1" } : null,
        }),
      };
      return builder;
    },
  },
}));

vi.mock("@/lib/pnaAssemblyRpc", () => ({ pnaAssemblyRpc: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Factory F28 governed QC gates", () => {
  it.each([
    ["materials_reserved", "INPUT_MATERIAL", true],
    ["partially_reserved", "INPUT_MATERIAL", true],
    ["planned", "INPUT_MATERIAL", false],
    ["in_progress", "FIRST_PIECE", true],
    ["in_progress", "IN_PROCESS", true],
    ["materials_reserved", "IN_PROCESS", false],
    ["qc_pending", "FINAL", true],
    ["in_progress", "FINAL", false],
    ["accepted", "FINAL", false],
  ] as const)("%s permits %s: %s", (status, stage, permitted) => {
    expect(canRecordAssemblyQcGate(status, stage)).toBe(permitted);
  });

  it("shows Core authority error, not synthetic PASS badges, when QC is unavailable", async () => {
    render(<AssemblyQcPanel jobId="job-1" jobStatus="in_progress" />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("QC data unavailable");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Do not assume approval");
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not evidenced")).toHaveLength(4);
  });
});
