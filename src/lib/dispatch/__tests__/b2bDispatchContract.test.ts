import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260804103000_b2b_dispatch_contract.sql"),
  "utf8",
);

describe("B2B Dispatch approved handover contract", () => {
  it("keeps dispatch within the approved B2B boundary", () => {
    expect(sql).toContain("confirmed B2B Sales Orders");
    expect(sql).toContain("outlet dispatch/replenishment");
    expect(sql).toContain("internal stock movement");
    expect(sql).toContain("b2b_dispatch_consignments");
  });

  it("preserves SO identity across multiple consignments", () => {
    expect(sql).toContain("UNIQUE (order_id, sequence_number)");
    expect(sql).toContain("b2b_dispatch_consignment_lines");
    expect(sql).toContain("original_order_qty");
    expect(sql).toContain("protect_b2b_dispatch_line_identity");
    expect(sql).toContain("create a superseding consignment line");
  });

  it("calculates residual from physical dispatch and authorised closure", () => {
    expect(sql).toContain("CREATE OR REPLACE VIEW public.b2b_dispatch_so_line_fulfilment");
    expect(sql).toContain("coalesce(sum(cl.dispatched_qty)");
    expect(sql).toContain("b2b_dispatch_residual_closures");
    expect(sql).toContain("customer_evidence_ref text NOT NULL");
    expect(sql).toContain("finance_adjustment_ref text NOT NULL");
  });

  it("requires exact carton identity, scans, weight and open-photo evidence", () => {
    expect(sql).toContain("b2b_dispatch_cartons");
    expect(sql).toContain("b2b_dispatch_carton_items");
    expect(sql).toContain("open_photo_ref IS NOT NULL");
    expect(sql).toContain("net_weight IS NOT NULL AND gross_weight IS NOT NULL");
    for (const block of [
      "blocked_wrong_so",
      "blocked_wrong_product",
      "blocked_wrong_batch",
      "blocked_duplicate",
      "blocked_expired",
      "blocked_unreleased",
      "blocked_excess",
    ]) {
      expect(sql).toContain(`'${block}'`);
    }
  });

  it("separates physical, commercial and delivery states", () => {
    expect(sql).toContain("b2b_dispatch_releases");
    expect(sql).toContain("b2b_dispatch_shipments");
    expect(sql).toContain("actual_departure_at");
    expect(sql).toContain("loading_evidence_ref IS NOT NULL AND transporter_ack_ref IS NOT NULL");
    expect(sql).toContain("pod_ref IS NOT NULL AND delivered_at IS NOT NULL");
    expect(sql).toContain("validate_b2b_dispatch_consignment_transition");
  });

  it("retains evidence and blocks anonymous/customer writes", () => {
    expect(sql).toContain("prevent_b2b_dispatch_delete");
    expect(sql).toContain("prevent_b2b_dispatch_append_only_update");
    expect(sql).toContain("REVOKE ALL ON public.%I FROM anon");
    expect(sql).toContain("can_manage_b2b_dispatch");
    expect(sql).toContain("can_verify_b2b_dispatch_finance");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.can_manage_b2b_dispatch(uuid) FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.can_manage_b2b_dispatch(uuid) TO authenticated");
    expect(sql).not.toMatch(/'CUSTOMER'|'BUYER'|'OUTLET_MANAGER'/);
  });

  it("models dispatch-visible QC without transferring upstream ownership", () => {
    expect(sql).toContain("b2b_dispatch_quality_checks");
    for (const family of ["pack_integrity", "product_condition", "labels", "traceability", "shelf_life", "transit_suitability"]) {
      expect(sql).toContain(`'${family}'`);
    }
    expect(sql).toContain("responsible_source text NULL");
    expect(sql).toContain("severity IN ('S1', 'S2', 'S3', 'S4')");
  });
});
