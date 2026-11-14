import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { submitQuotedCheckout } from "../../../../scripts/factory-certification/quoted-checkout.mjs";

const FP = "0123456789abcdef0123456789abcdef";
const dir = resolve(__dirname, "../../../../scripts/factory-certification");

type Call = { fn: string; args?: Record<string, unknown> };
function fakeClient(opts: { quote?: unknown; legacyRevoked?: boolean } = {}) {
  const calls: Call[] = [];
  return {
    calls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "submit_customer_order_v1" && opts.legacyRevoked !== false) {
        return { data: null, error: { message: "permission denied for function submit_customer_order_v1" } };
      }
      if (fn === "customer_checkout_quote_v1") return { data: "quote" in opts ? opts.quote : { fingerprint: FP }, error: null };
      if (fn === "submit_customer_order_quoted_v1") {
        return { data: [{ order_id: "o", order_number: "N", is_duplicate_submission: false }], error: null };
      }
      return { data: null, error: { message: `unexpected ${fn}` } };
    },
  };
}

describe("Factory certification quoted checkout (Core #488)", () => {
  it("quotes first, then submits with the quoted fingerprint, never the legacy writer", async () => {
    const c = fakeClient();
    const rows = await submitQuotedCheckout(c, { idempotencyKey: "k1", label: "T" });
    expect(c.calls.map((x) => x.fn)).toEqual(["customer_checkout_quote_v1", "submit_customer_order_quoted_v1"]);
    expect(c.calls[1].args).toEqual({ p_idempotency_key: "k1", p_quote_fingerprint: FP, p_requested_dispatch_date: null });
    expect(rows[0].order_id).toBe("o");
  });

  it("works when legacy authenticated execution is revoked", async () => {
    const c = fakeClient({ legacyRevoked: true });
    await expect(submitQuotedCheckout(c, { idempotencyKey: "k", label: "T" })).resolves.toBeTruthy();
    expect(c.calls.some((x) => x.fn === "submit_customer_order_v1")).toBe(false);
  });

  it.each([[{}], [{ fingerprint: "nope" }], [null]])("refuses to submit without a valid fingerprint (%j)", async (quote) => {
    const c = fakeClient({ quote });
    await expect(submitQuotedCheckout(c, { idempotencyKey: "k", label: "T" })).rejects.toThrow(/fingerprint/);
    expect(c.calls.map((x) => x.fn)).toEqual(["customer_checkout_quote_v1"]);
  });

  it("no Factory certification script calls the legacy writer", () => {
    for (const f of readdirSync(dir).filter((n) => /\.(mjs|cjs|sh|js)$/.test(n))) {
      expect(readFileSync(resolve(dir, f), "utf8"), f).not.toMatch(/rpc\(\s*["']submit_customer_order_v1["']/);
    }
    const seed = readFileSync(resolve(dir, "seed-production-fixtures.mjs"), "utf8");
    expect((seed.match(/submitQuotedCheckout\(/g) ?? []).length).toBe(3);
  });
});
