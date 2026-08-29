import { describe, expect, it } from "vitest";
import {
  EMPTY_THREE_PGS_RECEIPT_DRAFT,
  parseThreePgsReceiptDisposition,
  receiptDispositionFingerprint,
} from "@/lib/threePgsReceiptDisposition";

describe("3PGS receipt disposition", () => {
  it("accepts a reconciled partial disposition", () => {
    const result = parseThreePgsReceiptDisposition({
      ...EMPTY_THREE_PGS_RECEIPT_DRAFT,
      receivedQty: "6",
      acceptedQty: "4",
      damagedQty: "1",
      rejectedQty: "1",
      supplierBatchLot: "LOT-7",
      expiryDate: "2027-08-28",
      notes: "outer carton damaged",
    }, 6);

    expect(result).toMatchObject({
      ok: true,
      value: {
        receivedQty: 6,
        acceptedQty: 4,
        damagedQty: 1,
        rejectedQty: 1,
        supplierBatchLot: "LOT-7",
        expiryDate: "2027-08-28",
        notes: "outer carton damaged",
      },
    });
  });

  it("rejects disposition totals that do not equal physical receipt", () => {
    const result = parseThreePgsReceiptDisposition({
      ...EMPTY_THREE_PGS_RECEIPT_DRAFT,
      receivedQty: "6",
      acceptedQty: "6",
      damagedQty: "1",
      rejectedQty: "0",
    }, 6);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("must equal received quantity");
  });

  it("rejects receiving more than the procurement shortage", () => {
    const result = parseThreePgsReceiptDisposition({
      ...EMPTY_THREE_PGS_RECEIPT_DRAFT,
      receivedQty: "7",
      acceptedQty: "7",
      damagedQty: "0",
      rejectedQty: "0",
    }, 6);

    expect(result).toMatchObject({ ok: false, error: "Cannot receive more than the outstanding 6." });
  });

  it("allows a fully damaged/rejected arrival so no false stock need be accepted", () => {
    const result = parseThreePgsReceiptDisposition({
      ...EMPTY_THREE_PGS_RECEIPT_DRAFT,
      receivedQty: "6",
      acceptedQty: "0",
      damagedQty: "2",
      rejectedQty: "4",
    }, 6);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.acceptedQty).toBe(0);
  });

  it("fingerprints material receipt payload changes for safe retry blocking", () => {
    const first = {
      receivedQty: 6,
      acceptedQty: 4,
      damagedQty: 1,
      rejectedQty: 1,
      supplierBatchLot: "A",
      expiryDate: null,
      notes: null,
    };
    const changed = { ...first, acceptedQty: 5, damagedQty: 0 };

    expect(receiptDispositionFingerprint(first)).not.toBe(receiptDispositionFingerprint(changed));
    expect(receiptDispositionFingerprint(first)).toBe(receiptDispositionFingerprint({ ...first }));
  });
});
