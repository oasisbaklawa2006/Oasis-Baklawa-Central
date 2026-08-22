import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThirdPartyPackingMaterialCatalogue from "../ThirdPartyPackingMaterialCatalogue";

const catalogueRow = {
  product_id: "p1",
  sku: "CARTON-1",
  product_name: "Outer Carton",
  description: null,
  image_url: null,
  pack_size: "10 pcs",
  uom: "box",
  available_qty: 25,
  reserved_qty: 0,
  availability_status: "available" as const,
  lead_time_expected_at: null,
};

const otherRow = {
  ...catalogueRow,
  product_id: "p2",
  sku: "TRAY-1",
  product_name: "Serving Tray",
};

const bookingRow = {
  id: "r1",
  sku: "CARTON-1",
  requested_qty: 5,
  reserved_qty: 5,
  reservation_status: "reserved",
  source_department: "Packing & Assembly",
  notes: null,
  created_at: "2026-08-22T00:00:00.000Z",
};

const rpcMock = vi.fn(async () => ({ data: null, error: null as { message: string } | null }));

function makeQuery(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.like = () => builder;
  builder.limit = () => Promise.resolve(result);
  // `.order(...)` is the terminal call for the catalogue query (no `.limit`),
  // so make the builder itself thenable too.
  builder.then = (resolve: (value: typeof result) => void) => resolve(result);
  return builder;
}

let catalogueResult: unknown[] = [catalogueRow, otherRow];
let bookingsResult: unknown[] = [bookingRow];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_3pgs_packing_material_catalogue") {
        return makeQuery({ data: catalogueResult, error: null });
      }
      return makeQuery({ data: bookingsResult, error: null });
    },
  },
}));

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { email: "manager@oasisbaklawa.com" } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  catalogueResult = [catalogueRow, otherRow];
  bookingsResult = [bookingRow];
});

describe("ThirdPartyPackingMaterialCatalogue", () => {
  it("renders catalogue items and recent bookings from the governed view/table", async () => {
    render(<ThirdPartyPackingMaterialCatalogue />);
    expect(await screen.findByText("Outer Carton")).toBeTruthy();
    expect(screen.getByText("Serving Tray")).toBeTruthy();
    expect(screen.getByText("Packing & Assembly")).toBeTruthy();
  });

  it("filters the catalogue by search term (SKU or name)", async () => {
    render(<ThirdPartyPackingMaterialCatalogue />);
    await screen.findByText("Outer Carton");

    fireEvent.change(screen.getByPlaceholderText("Search SKU or name..."), { target: { value: "tray" } });

    expect(screen.queryByText("Outer Carton")).toBeNull();
    expect(screen.getByText("Serving Tray")).toBeTruthy();
  });

  it("blocks submission and never calls the RPC when quantity or department is missing", async () => {
    render(<ThirdPartyPackingMaterialCatalogue />);
    await screen.findByText("Outer Carton");

    fireEvent.click(screen.getAllByRole("button", { name: "Book" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("submits a valid booking with the expected RPC parameters and refetches", async () => {
    render(<ThirdPartyPackingMaterialCatalogue />);
    await screen.findByText("Outer Carton");

    fireEvent.click(screen.getAllByRole("button", { name: "Book" })[0]);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Requesting department"), {
      target: { value: "Packing & Assembly" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    const [fn, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("book_3pgs_packing_material_requisition");
    expect(args).toMatchObject({
      p_product_id: "p1",
      p_sku: "CARTON-1",
      p_requested_qty: 3,
      p_requesting_department: "Packing & Assembly",
    });
    expect(typeof args.p_correlation_id).toBe("string");
    // The dialog closes on success, which only happens after a successful RPC call.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm booking" })).toBeNull());
  });

  it("surfaces an RPC error via toast and keeps the dialog open", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Not authorised to reserve RGS stock" } });
    const { toast } = await import("sonner");
    render(<ThirdPartyPackingMaterialCatalogue />);
    await screen.findByText("Outer Carton");

    fireEvent.click(screen.getAllByRole("button", { name: "Book" })[0]);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Requesting department"), { target: { value: "Sales" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not authorised to reserve RGS stock"));
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeTruthy();
  });
});
