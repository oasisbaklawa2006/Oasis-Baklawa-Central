import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260803194132_phase2_b2b_store_fulfilment_contract.sql",
  ),
  "utf8",
);
const reservationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260526030000_execution_os_phase4a_inventory_reservation.sql",
  ),
  "utf8",
);

describe("Central v1 B2B store fulfilment contract", () => {
  it("defines exactly the four authorised store identities", () => {
    expect(sql).toContain(
      "store_code IN ('B2B_RAW', 'FINISHED_GOODS', '3PGS', 'PACKING_ASSEMBLY')",
    );
    expect(sql).toContain("b2b_inventory_stores_code_type_pair_check");
    expect(sql).not.toMatch(/outlet_stock|website_order|retail_reservation/i);
  });

  it("keeps 3PGS packaging-led with sourced ready goods as a distinct class", () => {
    expect(sql).toContain("packaging_and_sourced_goods");
    expect(sql).toContain("item_class IN ('packaging_material', 'sourced_ready_product')");
    expect(sql).toContain("b2b_inventory_sourced_provenance_check");
  });

  it("requires source evidence for every physical ledger movement", () => {
    expect(sql).toContain("inventory_movements_physical_source_check");
    expect(sql).toContain("source_document_type IS NOT NULL");
    expect(sql).toContain("source_document_reference");
    expect(reservationSql).toContain("prevent_inventory_movement_mutation");
  });

  it("records receipt variances and assembly reconciliation", () => {
    expect(sql).toContain("shortage_qty numeric GENERATED ALWAYS AS");
    expect(sql).toContain("excess_qty numeric GENERATED ALWAYS AS");
    expect(sql).toContain("b2b_inventory_receipt_lines_reconcile_check");
    expect(sql).toContain("b2b_assembly_components_issue_check");
    expect(sql).toContain("b2b_assembly_jobs_output_check");
  });

  it("enforces forward-only workflows and retained evidence", () => {
    expect(sql).toContain("validate_b2b_receipt_transition");
    expect(sql).toContain("validate_b2b_assembly_transition");
    expect(sql).toContain("prevent_b2b_fulfilment_delete");
    expect(sql).toContain("cancel or correct with a new movement");
  });

  it("exposes a staff-governed B2B availability view without double deduction", () => {
    expect(sql).toContain("CREATE OR REPLACE VIEW public.b2b_order_availability");
    expect(sql).toContain("greatest(balance.available_qty, 0::numeric) AS available_for_b2b_qty");
    expect(sql).toContain("WITH (security_invoker = true)");
    expect(sql).toContain("REVOKE ALL ON public.b2b_order_availability FROM anon");
  });
});
