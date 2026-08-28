import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(__dirname, "../src/pages/admin/ThreePgsProcurementQueue.tsx"),
  "utf-8",
);

test.describe("3PGS procurement receipt caller contract", () => {
  test("uses the canonical supplier receipt source with procurement provenance", () => {
    expect(source).toContain('p_receipt_source: "supplier"');
    expect(source).toContain('p_source_document_type: "procurement_requirement"');
    expect(source).not.toContain('p_receipt_source: "vendor_procurement"');
  });

  test("reuses the receipt correlation id across create, record and accept", () => {
    const matches = source.match(/p_correlation_id: receiptCorrelationId/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  test("credits procurement by accepted quantity rather than physical arrival", () => {
    expect(source).toContain("p_fulfilled_qty: disposition.acceptedQty");
    expect(source).not.toContain("p_fulfilled_qty: disposition.receivedQty");
  });

  test("passes the full receipt disposition to Core acceptance", () => {
    expect(source).toContain("accepted_qty: disposition.acceptedQty");
    expect(source).toContain("damaged_qty: disposition.damagedQty");
    expect(source).toContain("rejected_qty: disposition.rejectedQty");
  });
});
