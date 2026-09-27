import { describe, expect, it } from "vitest";
import {
  hasDirectOrdersTableMutation,
  hasForbiddenOrdersShadowMutation,
  scanOrdersTableUpdateMutations,
} from "../financeSurfaceSourceGuard";

describe("financeSurfaceSourceGuard — AST regression fixtures", () => {
  it("catches a direct chained orders update", () => {
    const fixture = `await supabase.from("orders").update({ status: "awaiting_final_payment" });`;
    expect(hasDirectOrdersTableMutation(fixture)).toBe(true);
    expect(scanOrdersTableUpdateMutations(fixture)).toHaveLength(1);
  });

  it("catches multiline and long chained orders updates", () => {
    const fixture = `
      await supabase
        .from(
          "orders"
        )
        .eq("id", orderId)
        .update({
          status: "awaiting_final_payment",
          sales_order_value: parsedTally,
        });
    `;
    expect(hasDirectOrdersTableMutation(fixture)).toBe(true);
    expect(hasForbiddenOrdersShadowMutation(fixture)).toBe(true);
    expect(scanOrdersTableUpdateMutations(fixture)).toHaveLength(1);
  });

  it("catches intermediate query-variable aliases", () => {
    const filler = "// ".concat("x".repeat(600));
    const fixture = `
      const q = supabase.from("orders");
      ${filler}
      await q.update({
        payment_status: "awaiting_advance",
      });
    `;
    expect(hasDirectOrdersTableMutation(fixture)).toBe(true);
    expect(hasForbiddenOrdersShadowMutation(fixture)).toBe(true);
    expect(scanOrdersTableUpdateMutations(fixture)).toHaveLength(1);
  });

  it("catches aliased builder variables with separated update calls", () => {
    const fixture = `
      const ordersTable = supabase.from('orders');
      const mutation = ordersTable.update({
        status: 'awaiting_final_payment',
        sales_order_value: parsedTally,
      });
      await mutation;
    `;
    expect(hasDirectOrdersTableMutation(fixture)).toBe(true);
    expect(hasForbiddenOrdersShadowMutation(fixture)).toBe(true);
  });

  it("allows unrelated table updates", () => {
    const fixture = `await supabase.from("companies").update({ credit_limit: 1000 });`;
    expect(hasDirectOrdersTableMutation(fixture)).toBe(false);
    expect(hasForbiddenOrdersShadowMutation(fixture)).toBe(false);
    expect(scanOrdersTableUpdateMutations(fixture)).toHaveLength(0);
  });

  it("allows read-only orders queries", () => {
    const fixture = `await supabase.from("orders").select("id, status").eq("id", orderId).single();`;
    expect(hasDirectOrdersTableMutation(fixture)).toBe(false);
    expect(hasForbiddenOrdersShadowMutation(fixture)).toBe(false);
    expect(scanOrdersTableUpdateMutations(fixture)).toHaveLength(0);
  });

  it("does not flag orders update payloads without forbidden shadow fields", () => {
    const fixture = `await supabase.from("orders").update({ notes: "reviewed" });`;
    expect(hasDirectOrdersTableMutation(fixture)).toBe(true);
    expect(hasForbiddenOrdersShadowMutation(fixture)).toBe(false);
  });
});
