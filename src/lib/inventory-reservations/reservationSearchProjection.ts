import { buildNormalizedTokenSet } from "@/lib/operational-search/searchIndexNormalizer";
import type { SearchIndexUpsertInput } from "@/lib/operational-search/searchIndexTypes";
import type { InventoryReservationRecord } from "./reservationTypes";
import { reservationStatusLabel } from "./reservationProjection";

export function projectReservationSearchEntry(row: InventoryReservationRecord): SearchIndexUpsertInput {
  const title = `Reservation ${row.reservationNumber}`;
  const subtitle = `${row.sku} · ${reservationStatusLabel(row.reservationStatus)}`;
  return {
    entityType: "dispatch_reference",
    entityId: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    queueItemId: row.queueItemId,
    scanRecordId: null,
    eventId: null,
    publicRef: row.reservationNumber,
    searchTitle: title,
    searchSubtitle: subtitle,
    searchBody: null,
    normalizedTokens: buildNormalizedTokenSet({
      title,
      subtitle,
      soNumbers: [],
      aliases: [row.sku, row.reservationNumber, "reservation"],
    }),
    aliases: ["reservation", row.sku],
    barcodeValues: [],
    soNumbers: [],
    phoneTokens: [],
    emailTokens: [],
    department: row.sourceDepartment,
    visibility: "internal",
    sensitivity: row.reservationStatus === "blocked" ? "restricted" : "normal",
    source: "projection:inventory_reservation",
    metadata: {
      status: row.reservationStatus,
      requestedQty: row.requestedQty,
      reservedQty: row.reservedQty,
    },
  };
}
