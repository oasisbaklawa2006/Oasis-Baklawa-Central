import { describe, expect, it } from "vitest";
import { parseBuyerCheckoutQuote, summariseBuyerCheckoutQuote } from "../buyerCheckoutQuote";

const line = { product_id: "p1", sku: "S1", product_name: "Pista", quantity: 2, selling_price: 6250, currency: "INR", uom: "carton", gst_rate: 5, tax_inclusive: false };
const quote = { draft_id: "d1", lines: [line], sales_order_value: 13125, advance_required: 3937.5, fingerprint: "0123456789abcdef0123456789abcdef" };

describe("Buyer checkout quotation", () => {
  it("splits Core's total into taxable value and GST for a tax-exclusive line", () => {
    const summary = summariseBuyerCheckoutQuote(parseBuyerCheckoutQuote(quote));
    expect(summary).toEqual({ taxable: 12500, tax: 625, total: 13125, advance: 3937.5, balance: 9187.5 });
  });

  it("extracts GST from a tax-inclusive line without changing Core's total", () => {
    const inclusive = parseBuyerCheckoutQuote({ ...quote, lines: [{ ...line, tax_inclusive: true }], sales_order_value: 12500, advance_required: 3750 });
    const summary = summariseBuyerCheckoutQuote(inclusive);
    expect(summary.total).toBe(12500);
    expect(summary.taxable).toBe(11904.76);
    expect(summary.tax).toBe(595.24);
  });

  it("accepts numeric strings from PostgREST", () => {
    expect(parseBuyerCheckoutQuote({ ...quote, sales_order_value: "13125", advance_required: "3937.5" }).sales_order_value).toBe(13125);
  });

  it.each([
    ["missing fingerprint", { ...quote, fingerprint: undefined }],
    ["short fingerprint", { ...quote, fingerprint: "abc" }],
    ["non-positive total", { ...quote, sales_order_value: 0 }],
    ["advance above total", { ...quote, advance_required: 20000 }],
    ["no lines", { ...quote, lines: [] }],
    ["malformed line", { ...quote, lines: [{ ...line, gst_rate: 150 }] }],
    ["not an object", null],
  ])("fails closed on %s", (_label, raw) => {
    expect(() => parseBuyerCheckoutQuote(raw)).toThrow();
  });
});
