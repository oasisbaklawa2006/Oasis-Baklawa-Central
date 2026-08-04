import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260804123000_b2b_unannounced_return_arrival.sql"),
  "utf8",
);

describe("unannounced B2B return-arrival contract", () => {
  it("keeps arrival conditional and inventory quarantined", () => {
    expect(sql).toContain("commercial_state text NOT NULL DEFAULT 'not_accepted'");
    expect(sql).toContain("inventory_state text NOT NULL DEFAULT 'quarantine_only'");
    expect(sql).not.toMatch(/available_for_b2b_qty|inventory_movements\s*\(/i);
  });

  it("requires evidence, authority, quarantine and conditional acknowledgement", () => {
    expect(sql).toContain("b2b_return_receipt_evidence_check");
    expect(sql).toContain("jsonb_array_length(gate_evidence_refs) > 0");
    expect(sql).toContain("unloading_authorised_by IS NOT NULL");
    expect(sql).toContain("quarantine_location IS NOT NULL");
    expect(sql).toContain("refusal_witness_ref IS NOT NULL");
  });

  it("separates QA evidence from commercial decisions", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.b2b_return_arrival_items");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.b2b_return_arrival_decisions");
    expect(sql).toContain("goodwill_without_admission");
  });

  it("retains evidence and denies anonymous access", () => {
    expect(sql).toContain("prevent_b2b_return_arrival_delete");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE public.%I FROM anon");
  });
});
