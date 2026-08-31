import { beforeEach, describe, expect, it } from "vitest";
import { clearCheckoutIdempotencyKey, getCheckoutIdempotencyKey, getLocalDateInputValue } from "./customerAppClient";

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

  it("uses the local calendar date for the dispatch-date minimum", () => {
    expect(getLocalDateInputValue(new Date(2026, 7, 31, 23, 45))).toBe("2026-08-31");
  });
});
