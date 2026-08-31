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
});
