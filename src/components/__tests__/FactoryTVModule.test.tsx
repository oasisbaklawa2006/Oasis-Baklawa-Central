import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FactoryTVModule from "../FactoryTVModule";

// Regression coverage for the owner-reported defect (2026-08-25): an
// RGS-created governed production_jobs row (e.g. job E3ED28B0, canonical
// department ARABIC_SWEETS, status "pending", priority "normal") never
// appeared on the department's factory TV, because this module previously
// derived its main grid from `orders`/`order_items` and only ever queried
// production_jobs for urgent/red priority rows. This module now reads
// production_jobs directly for the department, for every open status,
// regardless of priority.

let productionJobsRows: unknown[] = [];
let productionJobsFilters: { canonicalDepartment?: string; statuses?: string[] } = {};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: string) => {
        if (relation === "production_jobs" && column === "canonical_department") {
          productionJobsFilters.canonicalDepartment = value;
        }
        return builder;
      };
      builder.in = (column: string, values: string[]) => {
        if (relation === "production_jobs" && column === "status") {
          productionJobsFilters.statuses = values;
        }
        return builder;
      };
      builder.order = () => builder;
      builder.then = (resolve: (value: { data: unknown[]; error: null }) => void) => {
        if (relation === "production_jobs") {
          resolve({ data: productionJobsRows, error: null });
        } else {
          resolve({ data: [], error: null });
        }
      };
      return builder;
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  productionJobsRows = [];
  productionJobsFilters = {};
});

describe("FactoryTVModule", () => {
  it("shows a normal-priority pending production_jobs row -- the E3ED28B0 regression", async () => {
    productionJobsRows = [
      {
        id: "e3ed28b0-0000-0000-0000-000000000000",
        order_id: null,
        assigned_qty: 6,
        produced_qty: 0,
        priority: "normal",
        status: "pending",
        department: "arabic_sweets",
        created_at: new Date().toISOString(),
        product: { name: "Oasis Rings", sku: "OAS-RIN-3", image_url: null, uom: "PCS" },
      },
    ];

    render(<FactoryTVModule category="Arabic Sweets" departmentFilter="Arabic Sweets" title="Arabic Sweets Line" />);

    await waitFor(() => expect(screen.getByText("Oasis Rings")).toBeInTheDocument());
    expect(screen.queryByText("No Open Production Jobs")).not.toBeInTheDocument();
    expect(productionJobsFilters.canonicalDepartment).toBe("ARABIC_SWEETS");
    expect(productionJobsFilters.statuses).toEqual(["pending", "accepted", "in_production", "paused"]);
  });

  it("shows the empty state only when there are genuinely no open jobs", async () => {
    productionJobsRows = [];
    render(<FactoryTVModule category="Bakery" departmentFilter="Bakery" title="Bakery Line" />);
    await waitFor(() => expect(screen.getByText("No Open Production Jobs")).toBeInTheDocument());
    expect(productionJobsFilters.canonicalDepartment).toBe("BAKERY");
  });

  it("scopes the query to the correct canonical department per TV -- no cross-department leakage", async () => {
    productionJobsRows = [];
    render(<FactoryTVModule category="Fusion Sweets" departmentFilter="Fusion Sweets" title="Fusion Sweets Line" />);
    await waitFor(() => expect(productionJobsFilters.canonicalDepartment).toBe("FUSION_SWEETS"));
  });
});
