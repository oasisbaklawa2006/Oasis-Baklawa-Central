/** CTN-SO carton barcode helpers aligned with Central SO numbering. */

export const SALES_ORDER_NUMBER_PATTERN = /^SO-\d{4}-\d{4,6}$/i;
export const CTN_SO_BARCODE_PATTERN = /^CTN-SO-\d{4}-\d{4,6}$/i;

export function normalizeBarcodeToken(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidSalesOrderNumber(orderNumber: string): boolean {
  return SALES_ORDER_NUMBER_PATTERN.test(normalizeBarcodeToken(orderNumber));
}

export function isValidCtnSoBarcode(barcodeValue: string): boolean {
  return CTN_SO_BARCODE_PATTERN.test(normalizeBarcodeToken(barcodeValue));
}

/** CTN-SO barcode for an order number, e.g. SO-2026-000136 → CTN-SO-2026-000136 */
export function expectedCtnSoForOrderNumber(orderNumber: string): string {
  const normalizedOrder = normalizeBarcodeToken(orderNumber);
  if (!isValidSalesOrderNumber(normalizedOrder)) {
    return "";
  }
  return `CTN-${normalizedOrder}`;
}

export interface CtnSoValidationResult {
  ok: boolean;
  normalizedBarcode: string;
  normalizedExpected: string;
  normalizedOrderNumber: string;
  reason: string | null;
}

export function validateCtnSoBarcode(input: {
  barcodeValue: string;
  expectedBarcode: string;
  orderNumber: string;
}): CtnSoValidationResult {
  const normalizedBarcode = normalizeBarcodeToken(input.barcodeValue);
  const normalizedExpected = normalizeBarcodeToken(input.expectedBarcode);
  const normalizedOrderNumber = normalizeBarcodeToken(input.orderNumber);
  const derivedExpected = expectedCtnSoForOrderNumber(normalizedOrderNumber);

  if (!normalizedBarcode) {
    return fail(normalizedBarcode, normalizedExpected, normalizedOrderNumber, "barcode_value is required");
  }
  if (!normalizedOrderNumber) {
    return fail(normalizedBarcode, normalizedExpected, normalizedOrderNumber, "order_number is required");
  }
  if (!isValidSalesOrderNumber(normalizedOrderNumber)) {
    return fail(
      normalizedBarcode,
      normalizedExpected,
      normalizedOrderNumber,
      "order_number must match SO-YYYY-NNNN (4–6 digit sequence)",
    );
  }
  if (!isValidCtnSoBarcode(normalizedBarcode)) {
    return fail(
      normalizedBarcode,
      normalizedExpected,
      normalizedOrderNumber,
      "barcode_value must match CTN-SO-YYYY-NNNN pattern",
    );
  }
  if (!normalizedExpected) {
    return fail(normalizedBarcode, normalizedExpected, normalizedOrderNumber, "expected_barcode is required");
  }
  if (normalizedBarcode !== normalizedExpected) {
    return fail(
      normalizedBarcode,
      normalizedExpected,
      normalizedOrderNumber,
      "barcode_value must equal expected_barcode",
    );
  }
  if (normalizedExpected !== derivedExpected) {
    return fail(
      normalizedBarcode,
      normalizedExpected,
      normalizedOrderNumber,
      `expected_barcode must match order_number (${derivedExpected})`,
    );
  }

  return {
    ok: true,
    normalizedBarcode,
    normalizedExpected,
    normalizedOrderNumber,
    reason: null,
  };
}

function fail(
  normalizedBarcode: string,
  normalizedExpected: string,
  normalizedOrderNumber: string,
  reason: string,
): CtnSoValidationResult {
  return {
    ok: false,
    normalizedBarcode,
    normalizedExpected,
    normalizedOrderNumber,
    reason,
  };
}
