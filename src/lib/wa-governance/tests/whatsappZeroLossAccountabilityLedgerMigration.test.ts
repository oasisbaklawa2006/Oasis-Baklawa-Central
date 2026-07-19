import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260720003000_wa_zero_loss_accountability_ledger.sql",
  "utf8",
);

describe("WhatsApp zero-loss accountability ledger migration", () => {
  it("creates RLS-preserving read-only accountability surfaces", () => {
    expect(migration).toContain(
      "create or replace view public.whatsapp_business_intake_accountability_ledger",
    );
    expect(migration).toContain("with (security_invoker = true)");
    expect(migration).toContain(
      "create or replace view public.whatsapp_business_intake_accountability_control",
    );
    expect(migration).toContain(
      "create or replace function public.get_whatsapp_business_intake_accountability_exceptions()",
    );
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = public");
  });

  it("classifies every zero-loss accountability gap deterministically", () => {
    for (const state of [
      "UNACCOUNTED",
      "OWNER_MISSING",
      "NEXT_ACTION_MISSING",
      "SLA_MISSING",
      "OVERDUE",
      "CONVERSION_LINEAGE_MISSING",
      "CLOSURE_EVIDENCE_MISSING",
      "ACCOUNTED",
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toContain("zero_loss_invariant_holds");
    expect(migration).toContain("total_accountability_exceptions");
  });

  it("keeps the surface B2B-scoped and denies public or anonymous access", () => {
    expect(migration).toContain("i.business_domain = 'B2B'");
    expect(migration).toContain(
      "i.intake_kind in ('ORDER', 'POTENTIAL_ORDER', 'UNRESOLVED_RISK')",
    );
    expect(migration).toContain(
      "revoke all on public.whatsapp_business_intake_accountability_ledger from public",
    );
    expect(migration).toContain(
      "revoke all on public.whatsapp_business_intake_accountability_ledger from anon",
    );
    expect(migration).toContain(
      "grant select on public.whatsapp_business_intake_accountability_ledger to authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_whatsapp_business_intake_accountability_exceptions() to authenticated",
    );
  });

  it("contains no downstream operational writes", () => {
    const normalized = migration.toLowerCase();
    for (const forbidden of [
      "insert into public.orders",
      "insert into public.order_items",
      "update public.orders",
      "update public.order_items",
      "insert into public.sales_order_drafts",
      "insert into public.inventory",
      "insert into public.dispatch",
    ]) {
      expect(normalized).not.toContain(forbidden);
    }
  });
});
