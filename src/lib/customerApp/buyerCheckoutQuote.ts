/**
 * Core's authoritative checkout quote (customer_checkout_quote_v1). The Buyer must see and explicitly accept this
 * exact quotation (bound by its fingerprint) before submit_customer_order_quoted_v1 creates the Sales Order.
 * The client never computes a final amount: it only validates the shape and splits the Core total for display.
 */
export type BuyerCheckoutQuoteLine = {
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  selling_price: number;
  currency: string;
  uom: string;
  gst_rate: number;
  tax_inclusive: boolean;
};

export type BuyerCheckoutQuote = {
  draft_id: string;
  lines: BuyerCheckoutQuoteLine[];
  sales_order_value: number;
  advance_required: number;
  fingerprint: string;
};

export type BuyerCheckoutQuoteSummary = { taxable: number; tax: number; total: number; advance: number; balance: number };

const FINGERPRINT = /^[0-9a-f]{32}$/;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseLine(raw: unknown): BuyerCheckoutQuoteLine | null {
  if (!raw || typeof raw !== "object") return null;
  const line = raw as Record<string, unknown>;
  const quantity = finiteNumber(line.quantity);
  const price = finiteNumber(line.selling_price);
  const gst = finiteNumber(line.gst_rate);
  if (typeof line.product_id !== "string" || !line.product_id || quantity === null || quantity <= 0 || price === null || price <= 0
      || gst === null || gst < 0 || gst > 100 || typeof line.tax_inclusive !== "boolean") return null;
  return {
    product_id: line.product_id,
    sku: typeof line.sku === "string" ? line.sku : "",
    product_name: typeof line.product_name === "string" ? line.product_name : "",
    quantity,
    selling_price: price,
    currency: typeof line.currency === "string" && line.currency ? line.currency : "INR",
    uom: typeof line.uom === "string" && line.uom ? line.uom : "unit",
    gst_rate: gst,
    tax_inclusive: line.tax_inclusive,
  };
}

/** Fail closed: anything that is not a complete, internally consistent Core quote is rejected. */
export function parseBuyerCheckoutQuote(raw: unknown): BuyerCheckoutQuote {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("QUOTE_UNAVAILABLE");
  const quote = raw as Record<string, unknown>;
  const total = finiteNumber(quote.sales_order_value);
  const advance = finiteNumber(quote.advance_required);
  const lines = Array.isArray(quote.lines) ? quote.lines.map(parseLine) : [];
  if (typeof quote.draft_id !== "string" || !quote.draft_id || typeof quote.fingerprint !== "string" || !FINGERPRINT.test(quote.fingerprint)
      || total === null || total <= 0 || advance === null || advance <= 0 || advance > total
      || lines.length === 0 || lines.some((line) => line === null)) {
    throw new Error("QUOTE_INVALID");
  }
  return { draft_id: quote.draft_id, lines: lines as BuyerCheckoutQuoteLine[], sales_order_value: total, advance_required: advance, fingerprint: quote.fingerprint };
}

/** Splits Core's total into taxable value and GST using the same per-line rule Core applies to the snapshot. */
export function summariseBuyerCheckoutQuote(quote: BuyerCheckoutQuote): BuyerCheckoutQuoteSummary {
  const taxable = round2(quote.lines.reduce((sum, line) => {
    const base = line.quantity * line.selling_price;
    return sum + round2(line.tax_inclusive && line.gst_rate > 0 ? base / (1 + line.gst_rate / 100) : base);
  }, 0));
  return {
    taxable,
    tax: round2(quote.sales_order_value - taxable),
    total: quote.sales_order_value,
    advance: quote.advance_required,
    balance: round2(quote.sales_order_value - quote.advance_required),
  };
}

export class BuyerQuoteChangedError extends Error {
  constructor() {
    super("QUOTE_CHANGED_REFRESH_REQUIRED");
    this.name = "BuyerQuoteChangedError";
  }
}
