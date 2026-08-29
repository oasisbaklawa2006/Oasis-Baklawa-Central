export type ThreePgsReceiptDispositionDraft = {
  receivedQty: string;
  acceptedQty: string;
  damagedQty: string;
  rejectedQty: string;
  supplierBatchLot: string;
  expiryDate: string;
  notes: string;
};

export type ThreePgsReceiptDisposition = {
  receivedQty: number;
  acceptedQty: number;
  damagedQty: number;
  rejectedQty: number;
  supplierBatchLot: string | null;
  expiryDate: string | null;
  notes: string | null;
};

// Both fields are present in both variants so this remains safe under the
// repository's current TypeScript control-flow settings. The inactive field is
// `never` and is materialised as undefined only on the branch that returns
// before it can be consumed.
export type ThreePgsReceiptDispositionResult =
  | { ok: true; value: ThreePgsReceiptDisposition; error: never }
  | { ok: false; error: string; value: never };

export const EMPTY_THREE_PGS_RECEIPT_DRAFT: ThreePgsReceiptDispositionDraft = {
  receivedQty: "",
  acceptedQty: "",
  damagedQty: "",
  rejectedQty: "",
  supplierBatchLot: "",
  expiryDate: "",
  notes: "",
};

function failure(error: string): ThreePgsReceiptDispositionResult {
  return { ok: false, error, value: undefined as never };
}

function parseNonNegative(raw: string, label: string): number | string {
  if (raw.trim() === "") return `${label} quantity is required.`;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return `${label} quantity must be zero or greater.`;
  return value;
}

export function parseThreePgsReceiptDisposition(
  draft: ThreePgsReceiptDispositionDraft,
  outstandingQty: number,
): ThreePgsReceiptDispositionResult {
  const received = Number(draft.receivedQty);
  if (!draft.receivedQty.trim() || !Number.isFinite(received) || received <= 0) {
    return failure("Enter a positive received quantity.");
  }
  if (received > outstandingQty) {
    return failure(`Cannot receive more than the outstanding ${outstandingQty}.`);
  }

  const accepted = parseNonNegative(draft.acceptedQty, "Accepted");
  if (typeof accepted === "string") return failure(accepted);
  const damaged = parseNonNegative(draft.damagedQty, "Damaged");
  if (typeof damaged === "string") return failure(damaged);
  const rejected = parseNonNegative(draft.rejectedQty, "Rejected");
  if (typeof rejected === "string") return failure(rejected);

  const dispositioned = accepted + damaged + rejected;
  if (Math.abs(dispositioned - received) > 1e-9) {
    return failure(`Accepted + damaged + rejected must equal received quantity (${received}).`);
  }

  const expiryDate = draft.expiryDate.trim();
  if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    return failure("Expiry date must use YYYY-MM-DD.");
  }

  return {
    ok: true,
    error: undefined as never,
    value: {
      receivedQty: received,
      acceptedQty: accepted,
      damagedQty: damaged,
      rejectedQty: rejected,
      supplierBatchLot: draft.supplierBatchLot.trim() || null,
      expiryDate: expiryDate || null,
      notes: draft.notes.trim() || null,
    },
  };
}

export function receiptDispositionFingerprint(value: ThreePgsReceiptDisposition): string {
  return JSON.stringify(value);
}
