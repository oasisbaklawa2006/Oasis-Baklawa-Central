import { describe, expect, it } from "vitest";
import { mapReservationRow, mapReservationToInsertRow, toNumber } from "../reservationDbMappers";
import type { InventoryReservationRow } from "../reservationDbTypes";

describe("reservationDbMappers", () => {
  it("maps numeric strings from SQL", () => {
    expect(toNumber("10.5")).toBe(10.5);
  });

  it("maps reservation row to domain", () => {
    const row: InventoryReservationRow = {
      id: "00000000-0000-4000-8000-000000000001",
      reservation_number: "RES-1",
      order_id: "00000000-0000-4000-8000-000000000010",
      queue_item_id: null,
      customer_id: null,
      product_id: "00000000-0000-4000-8000-000000000020",
      sku: "SKU-A",
      requested_qty: "5",
      reserved_qty: "2",
      fulfilled_qty: "0",
      released_qty: "0",
      reservation_status: "partially_reserved",
      reservation_priority: "normal",
      source_department: null,
      reserved_by: null,
      approved_by: null,
      expires_at: null,
      notes: null,
      correlation_id: "c1",
      version: 2,
      created_at: "2026-05-24T10:00:00.000Z",
      updated_at: "2026-05-24T11:00:00.000Z",
    };
    const mapped = mapReservationRow(row);
    expect(mapped.reservedQty).toBe(2);
    expect(mapped.reservationStatus).toBe("partially_reserved");
  });

  it("round-trips insert payload keys", () => {
    const mapped = mapReservationRow({
      id: "id",
      reservation_number: "RES-X",
      order_id: "o",
      queue_item_id: null,
      customer_id: null,
      product_id: "p",
      sku: "S",
      requested_qty: 1,
      reserved_qty: 0,
      fulfilled_qty: 0,
      released_qty: 0,
      reservation_status: "pending",
      reservation_priority: "normal",
      source_department: null,
      reserved_by: null,
      approved_by: null,
      expires_at: null,
      notes: null,
      correlation_id: "c",
      version: 1,
      created_at: "2026-05-24T10:00:00.000Z",
      updated_at: "2026-05-24T10:00:00.000Z",
    });
    const insert = mapReservationToInsertRow(mapped);
    expect(insert.reservation_number).toBe("RES-X");
    expect(insert.sku).toBe("S");
  });
});
