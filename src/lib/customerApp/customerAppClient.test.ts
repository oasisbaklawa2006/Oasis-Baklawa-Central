import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { clearCheckoutIdempotencyKey, getCheckoutIdempotencyKey } from "./customerAppClient";

describe("customer checkout idempotency", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearCheckoutIdempotencyKey();
  });

  it("reuses one key across lost-response retries", () => {
    const first = getCheckoutIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(getCheckoutIdempotencyKey()).toBe(first);
  });

  it("rotates only after a successful submission clears the key", () => {
    const first = getCheckoutIdempotencyKey();
    clearCheckoutIdempotencyKey();
    expect(getCheckoutIdempotencyKey()).not.toBe(first);
  });

  it("keeps the Buyer requested dispatch date on the governed checkout path", () => {
    const buyerApp = readFileSync(resolve(process.cwd(), "src/pages/customer/BuyerApp.tsx"), "utf8");
    expect(buyerApp).toContain("customerAppClient.submit(getCheckoutIdempotencyKey(), requestedDispatchDate || undefined)");
    expect(buyerApp).toContain('id="buyer-requested-dispatch-date"');
  });

  it("renders only the Core-returned SO reference and never predicts the approved format", () => {
    const buyerApp = readFileSync(resolve(process.cwd(), "src/pages/customer/BuyerApp.tsx"), "utf8");
    expect(buyerApp).toContain("const APPROVED_SO_NUMBER_PATTERN = /^SO\\d{4}\\/\\d{2}-\\d{4}$/;");
    expect(buyerApp).toContain("<BuyerSoReference orderNumber={o.order_number} />");
    expect(buyerApp).toContain("Canonical format pending Core");
    expect(buyerApp).not.toMatch(/SO\\$\\{|lpad|monthly.*sequence/i);
  });

  it("keeps support submission separate from governed SO checkout", () => {
    const buyerApp = readFileSync(resolve(process.cwd(), "src/pages/customer/BuyerApp.tsx"), "utf8");
    const supportSection = buyerApp.slice(buyerApp.indexOf("function Support"), buyerApp.indexOf("function Home"));
    expect(supportSection).toContain("customerAppClient.submitTicket");
    expect(supportSection).not.toContain("customerAppClient.submit(");
  });

  it("shows Core order value and preserves requested versus promised dispatch facts", () => {
    const buyerApp = readFileSync(resolve(process.cwd(), "src/pages/customer/BuyerApp.tsx"), "utf8");
    const detailSection = buyerApp.slice(buyerApp.indexOf("function OrderDetail"), buyerApp.indexOf("function Account"));
    expect(detailSection).toContain("SO value");
    expect(detailSection).toContain("Requested dispatch");
    expect(detailSection).toContain("Promised dispatch");
    expect(detailSection).toContain("order.requested_dispatch_date");
    expect(detailSection).toContain("order.promised_dispatch_date");
  });
});
