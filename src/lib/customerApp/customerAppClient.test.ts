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
});

