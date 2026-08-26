import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RgsProductionDemandPlanner from "../RgsProductionDemandPlanner";

function makeFailingReservationQuery() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.in = () => builder;
  builder.order = () => builder;
  builder.limit = () => Promise.resolve({ data: null, error: { message: "reservation backend unavailable" } });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "inventory_reservations") return makeFailingReservationQuery();
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    },
  },
}));

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: vi.fn(async () => ({ data: null, error: null })) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe("RgsProductionDemandPlanner read-error state", () => {
  it("surfaces the read error without presenting a successful zero-shortage state", async () => {
    render(<RgsProductionDemandPlanner />);

    await waitFor(() => {
      expect(screen.getByText(/Demand could not be read: reservation backend unavailable/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Current shortage totals unavailable until demand can be read/i)).toBeInTheDocument();
    expect(screen.queryByText(/No open RGS shortage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total open shortage across 0 SKU/i)).not.toBeInTheDocument();
  });
});