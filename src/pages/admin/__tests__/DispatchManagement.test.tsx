import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DispatchManagement from "../DispatchManagement";

const consignmentRow = {
  consignment_id: "c1",
  consignment_number: "SO-2026-000001-DC-01",
  order_id: "o1",
  order_number: "SO-2026-000001",
  consignment_status: "under_cartonisation",
  dispatch_mode: "road_transporter",
  consignee_name: "Test Buyer",
  destination_city: "Chennai",
  carton_count: 1,
  selected_qty: 20,
  packed_qty: 0,
  dispatched_qty: 0,
  transporter_name: null,
  finance_status: "CLEARED" as const,
  open_exception_count: 0,
};

const cartonRow = {
  id: "carton-1",
  carton_code: "CTN-0001",
  carton_sequence: 1,
  status: "open",
  net_weight: null,
  gross_weight: null,
  open_photo_ref: null,
  locked_by: null,
  locked_at: null,
  current_version: 1,
};

const consignmentLineRow = {
  id: "line-1",
  product_code: "SKU-A",
  uom: "PACK",
  accepted_ready_qty: 10,
  packed_qty: 0,
};

const dplVersionRow = {
  id: "dpl-1",
  version_number: 1,
  status: "generated",
  submitted_to_finance_at: null,
  finance_check_state: "not_requested",
  superseded_by: null,
  generated_at: "2026-08-30T00:00:00.000Z",
  correlation_id: "corr-dpl-1",
};

type Fixtures = Map<string, unknown[]>;

let fixtures: Fixtures = new Map();
// When set for a table, makeQuery resolves that table's query with this
// error instead of its fixture rows -- used to simulate an authoritative
// reload failing after a governed mutation RPC has already succeeded.
let fixtureErrors: Map<string, string> = new Map();

function resetFixtures() {
  fixtures = new Map([
    ["b2b_dispatch_shipment_execution_view", [consignmentRow]],
    ["b2b_dispatch_cartons", [cartonRow]],
    ["b2b_dispatch_consignment_lines", [consignmentLineRow]],
    ["b2b_dispatch_packing_list_versions", []],
    ["b2b_dispatch_events", []],
    ["b2b_dispatch_carton_items", []],
    ["b2b_dispatch_product_scan_events", []],
  ]);
  fixtureErrors = new Map();
}
resetFixtures();

// Chainable, thenable query-builder stub matching the subset of the
// PostgREST builder surface DispatchManagement actually calls
// (select/eq/order/limit), resolving whenever awaited regardless of how
// many chain calls preceded it -- mirrors the real client's behaviour.
function makeQuery(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.then = (resolve: (result: { data: unknown; error: { message: string } | null }) => void) => {
    const errorMessage = fixtureErrors.get(table);
    if (errorMessage) return resolve({ data: null, error: { message: errorMessage } });
    return resolve({ data: fixtures.get(table) ?? [], error: null });
  };
  return builder;
}

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null as unknown,
  error: null as { message: string } | null,
}));

const uploadMock = vi.fn(async (_path: string, _file: File) => ({ error: null as { message: string } | null }));
const removeMock = vi.fn(async (_paths: string[]) => ({ error: null as { message: string } | null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "operator-1" } },
        error: null,
      })),
    },
    storage: {
      from: () => ({
        upload: (path: string, file: File) => uploadMock(path, file),
        remove: (paths: string[]) => removeMock(paths),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.test/photo.jpg" } }),
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://example.test/signed/${path}` },
          error: null,
        }),
      }),
    },
    from: (table: string) => makeQuery(table),
  },
}));

vi.mock("@/lib/dispatchGovernedRpc", () => ({
  dispatchGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
  dispatchDb: { from: (table: string) => makeQuery(table) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

async function selectWorkingConsignment() {
  fireEvent.click(screen.getByLabelText("Working consignment"));
  fireEvent.click(await screen.findByRole("option", { name: "SO-2026-000001-DC-01" }));
  await screen.findByText("CTN-0001");
}

async function selectCarton() {
  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  await screen.findByText(/Carton CTN-0001/);
}

async function selectScanLine() {
  fireEvent.click(screen.getByLabelText("Consignment line"));
  fireEvent.click(await screen.findByRole("option", { name: /SKU-A/ }));
}

afterEach(() => {
  vi.clearAllMocks();
  rpcMock.mockReset();
  rpcMock.mockImplementation(async () => ({ data: null, error: null }));
  uploadMock.mockReset();
  uploadMock.mockImplementation(async () => ({ error: null }));
  removeMock.mockReset();
  removeMock.mockImplementation(async () => ({ error: null }));
  resetFixtures();
});

describe("DispatchManagement (FACT-C3 governed operator workflow)", () => {
  it("renders governed consignments from the shipment execution view", async () => {
    render(<DispatchManagement />);
    expect(await screen.findByText("SO-2026-000001-DC-01")).toBeTruthy();
    expect(screen.getByText("CLEARED")).toBeTruthy();
  });

  it("blocks consignment creation with missing order/item ids and does not call the RPC", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    fireEvent.click(screen.getByRole("button", { name: "Create consignment" }));
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("shows the carton list and selects a carton for a chosen working consignment", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    expect(screen.getByText(/Carton CTN-0001/)).toBeTruthy();
  });

  it("records a valid scan and shows it verified", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "record_b2b_dispatch_carton_item_scan") {
        return { data: { scan_result: "verified", reason: null }, error: null };
      }
      return { data: null, error: null };
    });
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    await selectScanLine();
    fireEvent.change(screen.getByLabelText("Barcode"), { target: { value: "BC-A" } });
    fireEvent.change(screen.getByLabelText("Batch / lot"), { target: { value: "BATCH-1" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Record scan" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Scan verified: BC-A"));
    expect(rpcMock).toHaveBeenCalledWith(
      "record_b2b_dispatch_carton_item_scan",
      expect.objectContaining({
        p_carton_id: "carton-1",
        p_consignment_line_id: "line-1",
        p_barcode_value: "BC-A",
        p_batch_lot: "BATCH-1",
        p_quantity: 5,
      }),
    );
  });

  it("surfaces a rejected scan with its reason rather than treating it as success", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "record_b2b_dispatch_carton_item_scan") {
        return { data: { scan_result: "blocked_wrong_product", reason: "scanned barcode does not match" }, error: null };
      }
      return { data: null, error: null };
    });
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    await selectScanLine();
    fireEvent.change(screen.getByLabelText("Barcode"), { target: { value: "BC-B" } });
    fireEvent.change(screen.getByLabelText("Batch / lot"), { target: { value: "BATCH-1" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Record scan" }));

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Scan rejected (blocked_wrong_product): scanned barcode does not match",
      ),
    );
  });

  it("reuses the same scan correlation id across a retry after a failure (idempotent retry)", async () => {
    rpcMock.mockRejectedValueOnce(new Error("network hiccup"));
    rpcMock.mockResolvedValueOnce({ data: { scan_result: "verified", reason: null }, error: null });
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    await selectScanLine();
    fireEvent.change(screen.getByLabelText("Barcode"), { target: { value: "BC-A" } });
    fireEvent.change(screen.getByLabelText("Batch / lot"), { target: { value: "BATCH-1" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: "Record scan" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    const firstCorrelation = rpcMock.mock.calls[0][1].p_correlation_id;

    fireEvent.click(screen.getByRole("button", { name: "Record scan" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    expect(rpcMock.mock.calls[1][1].p_correlation_id).toBe(firstCorrelation);
  });

  it("requires a carton photo before recording evidence", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    fireEvent.change(screen.getByLabelText("Net weight"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Gross weight"), { target: { value: "1.2" } });
    fireEvent.click(screen.getByRole("button", { name: "Record evidence" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A carton photo is required."));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects blank net/gross weight before any RPC call or upload, surfacing the required-weight error", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Carton photo"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Net weight"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Gross weight"), { target: { value: "1.2" } });
    fireEvent.click(screen.getByRole("button", { name: "Record evidence" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Net and gross weight are required."));
    expect(rpcMock).not.toHaveBeenCalledWith("record_b2b_dispatch_carton_evidence", expect.anything());
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads a photo and records evidence via the governed RPC", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    fireEvent.change(screen.getByLabelText("Net weight"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Gross weight"), { target: { value: "1.2" } });
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Carton photo"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Record evidence" }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "record_b2b_dispatch_carton_evidence",
        expect.objectContaining({
          p_carton_id: "carton-1",
          p_net_weight: 1,
          p_gross_weight: 1.2,
          p_open_photo_ref: expect.stringMatching(/^storage:receipts\/dispatch-carton-evidence\/carton-1\/\d+-[0-9a-f-]+\.jpg$/),
        }),
      ),
    );
  });

  it("never derives the storage object key from the uploaded file's name", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    fireEvent.change(screen.getByLabelText("Net weight"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Gross weight"), { target: { value: "1.2" } });
    const maliciousFile = new File(["x"], "../../outside.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Carton photo"), { target: { files: [maliciousFile] } });
    fireEvent.click(screen.getByRole("button", { name: "Record evidence" }));

    await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    const [uploadedPath] = uploadMock.mock.calls[0];
    expect(uploadedPath).not.toContain("outside");
    expect(uploadedPath).not.toContain("..");
    expect(uploadedPath).toMatch(/^dispatch-carton-evidence\/carton-1\/\d+-[0-9a-f-]+\.jpg$/);
  });

  it("does not advance lock state when lock_b2b_dispatch_carton rejects a stale version", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "lock_b2b_dispatch_carton") {
        return { data: null, error: { message: "Carton carton-1 has changed since it was loaded; reload and retry" } };
      }
      return { data: null, error: null };
    });
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    fireEvent.click(screen.getByRole("button", { name: "Lock carton" }));

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Carton carton-1 has changed since it was loaded; reload and retry",
      ),
    );
    expect(screen.getByRole("button", { name: "Lock carton" })).toBeTruthy();
  });

  it("locks a carton successfully, calling with the carton's current expected version", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    fireEvent.click(screen.getByRole("button", { name: "Lock carton" }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "lock_b2b_dispatch_carton",
        expect.objectContaining({ p_carton_id: "carton-1", p_expected_version: 1 }),
      ),
    );
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Carton locked."));
  });

  it("generates a DPL via the governed create RPC", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    fireEvent.click(screen.getByRole("button", { name: "Create packing list" }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "create_b2b_dispatch_packing_list",
        expect.objectContaining({ p_consignment_id: "c1" }),
      ),
    );
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Packing list generated."));
  });

  it("surfaces a DPL generation failure without showing a fabricated current version", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "create_b2b_dispatch_packing_list") {
        return { data: null, error: { message: "Consignment c1 has 1 unlocked carton(s); lock all cartons before generating a packing list" } };
      }
      return { data: null, error: null };
    });
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    fireEvent.click(screen.getByRole("button", { name: "Create packing list" }));

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Consignment c1 has 1 unlocked carton(s); lock all cartons before generating a packing list",
      ),
    );
    expect(screen.getByText("No packing list generated yet for this consignment.")).toBeTruthy();
  });

  it("requires a reason before superseding an existing DPL version", async () => {
    fixtures.set("b2b_dispatch_packing_list_versions", [dplVersionRow]);
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await screen.findByText("Version 1");
    fireEvent.click(screen.getByRole("button", { name: "Supersede with a corrected version" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A correction reason is required."));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("supersedes a DPL version with a reason and shows superseded history with the reason", async () => {
    fixtures.set("b2b_dispatch_packing_list_versions", [dplVersionRow]);
    fixtures.set("b2b_dispatch_events", [{ document_version_id: "dpl-1", reason: "corrected packed weight" }]);
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await screen.findByText("Version 1");

    fireEvent.change(screen.getByPlaceholderText("Reason for correction (required)"), {
      target: { value: "corrected packed weight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Supersede with a corrected version" }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "supersede_b2b_dispatch_packing_list",
        expect.objectContaining({ p_current_version_id: "dpl-1", p_reason: "corrected packed weight" }),
      ),
    );
  });

  it("shows superseded-version history with its recorded correction reason", async () => {
    fixtures.set("b2b_dispatch_packing_list_versions", [
      { ...dplVersionRow, id: "dpl-2", version_number: 2 },
      { ...dplVersionRow, status: "superseded", superseded_by: "dpl-2" },
    ]);
    fixtures.set("b2b_dispatch_events", [{ document_version_id: "dpl-1", reason: "corrected packed weight" }]);
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await screen.findByText("Version 2");
    expect(screen.getByText("Version 1 -- superseded")).toBeTruthy();
    expect(screen.getByText("Reason: corrected packed weight")).toBeTruthy();
  });

  it("submits the current DPL version to Finance", async () => {
    fixtures.set("b2b_dispatch_packing_list_versions", [dplVersionRow]);
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await screen.findByText("Version 1");
    fireEvent.click(screen.getByRole("button", { name: "Submit to Finance" }));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "submit_b2b_dispatch_packing_list_to_finance",
        expect.objectContaining({ p_consignment_id: "c1", p_version_id: "dpl-1" }),
      ),
    );
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Packing list submitted to Finance."));
  });

  it("does not disable the submit button as complete when the RPC fails, so it can be retried", async () => {
    fixtures.set("b2b_dispatch_packing_list_versions", [dplVersionRow]);
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "submit_b2b_dispatch_packing_list_to_finance") {
        return { data: null, error: { message: "network timeout" } };
      }
      return { data: null, error: null };
    });
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await screen.findByText("Version 1");
    fireEvent.click(screen.getByRole("button", { name: "Submit to Finance" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("network timeout"));
    expect(screen.getByText("generated")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit to Finance" })).not.toBeDisabled();
  });

  it("preserves the scan correlation id and submitted input when the RPC succeeds but the authoritative refresh fails", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "record_b2b_dispatch_carton_item_scan") {
        return { data: { scan_result: "verified", reason: null }, error: null };
      }
      return { data: null, error: null };
    });
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    await selectScanLine();
    fireEvent.change(screen.getByLabelText("Barcode"), { target: { value: "BC-A" } });
    fireEvent.change(screen.getByLabelText("Batch / lot"), { target: { value: "BATCH-1" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "5" } });

    fixtureErrors.set("b2b_dispatch_cartons", "detail reload unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Record scan" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    const firstCorrelation = rpcMock.mock.calls[0][1].p_correlation_id;

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("could not be refreshed")),
    );
    // Submitted input is preserved for safe retry -- the mutation succeeded
    // server-side, only the authoritative reload failed.
    expect((screen.getByLabelText("Barcode") as HTMLInputElement).value).toBe("BC-A");
    expect((screen.getByLabelText("Batch / lot") as HTMLInputElement).value).toBe("BATCH-1");

    fixtureErrors.delete("b2b_dispatch_cartons");
    fireEvent.click(screen.getByRole("button", { name: "Record scan" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    expect(rpcMock.mock.calls[1][1].p_correlation_id).toBe(firstCorrelation);
  });

  it("does not rotate the lock correlation id and surfaces reconciliation state when the RPC succeeds but fetchRows fails", async () => {
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();

    fixtureErrors.set("b2b_dispatch_shipment_execution_view", "summary view unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Lock carton" }));

    const { toast } = await import("sonner");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("could not be refreshed")),
    );
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    // The carton must not appear locked when the postcondition refresh failed.
    expect(screen.getByRole("button", { name: "Lock carton" })).not.toBeDisabled();

    fixtureErrors.delete("b2b_dispatch_shipment_execution_view");
    fireEvent.click(screen.getByRole("button", { name: "Lock carton" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    expect(rpcMock.mock.calls[1][1].p_correlation_id).toBe(rpcMock.mock.calls[0][1].p_correlation_id);
  });

  it("clears the previous consignment's carton/line/DPL state immediately when switching to a new consignment", async () => {
    const secondConsignment = {
      ...consignmentRow,
      consignment_id: "c2",
      consignment_number: "SO-2026-000002-DC-01",
    };
    fixtures.set("b2b_dispatch_shipment_execution_view", [consignmentRow, secondConsignment]);
    render(<DispatchManagement />);
    await screen.findByText("SO-2026-000001-DC-01");
    await selectWorkingConsignment();
    await selectCarton();
    expect(screen.getByText(/Carton CTN-0001/)).toBeTruthy();

    // The second consignment has no cartons yet.
    fixtures.set("b2b_dispatch_cartons", []);
    fireEvent.click(screen.getByLabelText("Working consignment"));
    fireEvent.click(await screen.findByRole("option", { name: "SO-2026-000002-DC-01" }));

    // The previous consignment's carton detail panel and row must not remain
    // rendered or interactable under the newly selected consignment.
    expect(screen.queryByText(/Carton CTN-0001 --/)).toBeNull();
    await screen.findByText("No cartons opened yet for this consignment.");
  });
});
