import { describe, expect, it } from "vitest";
import { point100RpcProbeArgs } from "./probes";

describe("Point100 signature-aware RPC capability probes", () => {
  it("uses the canonical RGS reservation signature", () => {
    expect(Object.keys(point100RpcProbeArgs("reserve_rgs_stock")).sort()).toEqual(
      [
        "p_reservation_number",
        "p_order_id",
        "p_product_id",
        "p_sku",
        "p_requested_qty",
        "p_source_department",
        "p_correlation_id",
        "p_priority",
        "p_location_code",
        "p_queue_item_id",
        "p_customer_id",
        "p_demand_source_type",
        "p_demand_reference",
      ].sort(),
    );
  });

  it("uses canonical Trace handover parameter names", () => {
    expect(Object.keys(point100RpcProbeArgs("trace_verify_handover_evidence_v1")).sort()).toEqual(
      ["p_evidence", "p_prior_hash", "p_expected_action", "p_enforce_consumption"].sort(),
    );
  });
});
