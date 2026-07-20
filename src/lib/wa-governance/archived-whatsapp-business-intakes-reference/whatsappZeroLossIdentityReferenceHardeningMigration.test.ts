import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719041000_wa_zero_loss_identity_reference_hardening.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp identity reference hardening", () => {
  it("hydrates only references that still exist", () => {
    expect(sql).toContain("exists (");
    expect(sql).toContain("from public.whatsapp_contacts c");
    expect(sql).toContain("from public.companies company");
    expect(sql).toContain("where c.id = submitter_contact_uuid");
    expect(sql).toContain("where c.id = original_contact_uuid");
    expect(sql).toContain("where company.id = customer_uuid");
  });

  it("keeps missing evidence from producing resolved status", () => {
    expect(sql).toContain("nullif(btrim(new.identity_resolution_note), '') is not null");
    expect(sql).toContain("new.identity_resolution_status := 'partial'");
  });

  it("backfills only existing commercial customers and retains unresolved work", () => {
    expect(sql).toContain("join public.companies company on company.id = candidate.customer_id");
    expect(sql).toContain("else 'partial'");
    expect(sql).toContain("invalid or stale metadata remains unresolved");
  });

  it("contains no executable order, finance, dispatch, or inventory writes", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});