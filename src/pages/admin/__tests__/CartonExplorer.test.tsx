import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CartonExplorer from "../CartonExplorer";

const consignmentRow = {
  consignment_id: "c1",
  consignment_number: "SO-2026-000001-DC-01",
  order_number: "SO-2026-000001",
  consignment_status: "under_cartonisation",
  carton_count: 1,
  packed_qty: 10,
  selected_qty: 10,
};

const cartonRow = {
  id: "carton-1",
  consignment_id: "c1",
  carton_code: "CTN-0001",
  carton_sequence: 1,
  status: "locked",
  net_weight: 1.5,
  gross_weight: 2,
  open_photo_ref: "https://storage/photo.jpg",
  seal_reference: null,
  locked_by: "op1",
  locked_at: "2026-08-30T00:00:00.000Z",
  current_version: 1,
};

const lineRow = {
  id: "line-1",
  product_code: "SKU-A",
  accepted_ready_qty: 10,
  packed_qty: 10,
};

const itemRow = {
  id: "item-1",
  carton_id: "carton-1",
  consignment_line_id: "line-1",
  order_item_id: "oi-1",
  product_code: "SKU-A",
  barcode_value: "BC-1",
  batch_lot: "LOT-1",
  quantity: 10,
  scanned_at: "2026-08-30T00:00:00.000Z",
};

type Fixtures = Map<string, unknown[]>;
let fixtures: Fixtures = new Map();

function makeQuery(table: string) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.then = (resolve: (v: unknown) => void) => {
    resolve({ data: fixtures.get(table) ?? [], error: null });
    return Promise.resolve({ data: fixtures.get(table) ?? [], error: null });
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
  },
}));

vi.mock("@/lib/dispatchGovernedRpc", () => ({
  dispatchDb: {
    from: (table: string) => makeQuery(table),
  },
}));

function renderExplorer() {
  return render(
    <MemoryRouter>
      <CartonExplorer />
    </MemoryRouter>,
  );
}

describe("CartonExplorer live bind", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows read-only live badge and packing contracts when consignments exist", async () => {
    fixtures = new Map([
      ["b2b_dispatch_shipment_execution_view", [consignmentRow]],
      ["b2b_dispatch_cartons", [cartonRow]],
      ["b2b_dispatch_consignment_lines", [lineRow]],
      ["b2b_dispatch_packing_list_versions", []],
      ["b2b_dispatch_carton_items", [itemRow]],
    ]);

    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText(/Live · 1 consignments/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.getByText("Carton uniqueness")).toBeInTheDocument();
    expect(screen.getByText("Quantity conservation")).toBeInTheDocument();
  });

  it("shows empty state without fabricating cartons", async () => {
    fixtures = new Map([["b2b_dispatch_shipment_execution_view", []]]);

    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText(/No governed consignments/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("CTN-0001")).not.toBeInTheDocument();
  });
});
