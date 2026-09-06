import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Point 75 — order amendment surface authority guard", () => {
  const evidence = readFileSync(resolve(process.cwd(), "docs/POINT75_ORDER_AMENDMENT_CLOSURE_EVIDENCE.md"), "utf8");
  const client = source("src/lib/order-authority/orderAmendmentAuthorityClient.ts");
  const panel = source("src/components/admin/OrderAmendmentActionsPanel.tsx");
  const traceSheet = source("src/components/admin/OrderTraceSheet.tsx");
  const orderManagement = source("src/pages/admin/OrderManagement.tsx");
  const databaseTypes = source("src/integrations/supabase/database.types.ts");

  it("documents Core prerequisite and main SHA census", () => {
    expect(evidence).toContain("64a107df");
    expect(evidence).toContain("get_order_amendment_facts_v1");
    expect(evidence).toContain("BLOCKED");
    expect(evidence).toContain("Point 76");
    expect(evidence).toContain("Points 77");
  });

  it("authority client binds only to Core RPC family — no shadow order/line updates", () => {
    for (const rpc of [
      "get_order_amendment_facts_v1",
      "request_order_amendment_v1",
      "request_order_cancellation_v1",
      "request_order_substitution_v1",
    ]) {
      expect(client).toContain(rpc);
    }
    expect(client).not.toContain('.from("orders").update');
    expect(client).not.toContain('.from("order_items").update');
    expect(client).not.toContain('.from("order_items").insert');
    expect(client).not.toContain('.from("order_items").delete');
    expect(client).toContain("POINT75_CORE_PREREQUISITE");
  });

  it("Order Trace mounts governed change panel without direct mutation", () => {
    expect(traceSheet).toContain("OrderAmendmentActionsPanel");
    expect(traceSheet).not.toContain('.from("orders").update');
    expect(traceSheet).not.toContain('.from("order_items").update');
  });

  it("Order Amendment panel delegates mutations to authority client only", () => {
    expect(panel).toContain('data-point="75"');
    expect(panel).toContain("requestOrderAmendment");
    expect(panel).toContain("requestOrderCancellation");
    expect(panel).toContain("requestOrderSubstitution");
    expect(panel).toContain("getOrderAmendmentFacts");
    expect(panel).not.toContain('.from("orders").update');
    expect(panel).not.toContain('.from("order_items").update');
    expect(panel).not.toContain('.from("order_items").insert');
  });

  it("Order Management remains free of amendment/cancel/substitute shadow writes", () => {
    expect(orderManagement).not.toContain("requestOrderAmendment");
    expect(orderManagement).not.toContain('.from("orders").update');
    for (const forbidden of ["cancelOrder", "amendOrder", "substituteOrder", "requestOrderCancellation"]) {
      expect(orderManagement, `shadow token must remain absent: ${forbidden}`).not.toContain(forbidden);
    }
    expect(orderManagement).toContain('status: "cancelled"');
    expect(orderManagement).not.toMatch(/next:\s*"cancelled"/);
  });

  it("database.types.ts census shows Core amendment RPC family absent at Central main", () => {
    expect(databaseTypes).not.toContain("get_order_amendment_facts_v1");
    expect(databaseTypes).not.toContain("request_order_amendment_v1");
    expect(databaseTypes).not.toContain("request_order_cancellation_v1");
    expect(databaseTypes).not.toContain("request_order_substitution_v1");
  });
});
