import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719130000_wa_zero_loss_reconciliation_exceptions.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp zero-loss reconciliation exceptions", () => {
  it("derives silent-loss breaches instead of trusting only the stored flag", () => {
    expect(sql).toContain("explicitly_unaccounted");
    expect(sql).toContain("active_pending_owner_missing");
    expect(sql).toContain("active_pending_next_action_missing");
    expect(sql).toContain("converted_link_missing");
    expect(sql).toContain("explicit_closure_evidence_missing");
  });

  it("surfaces stale and incomplete pending work", () => {
    expect(sql).toContain("active_pending_sla_missing");
    expect(sql).toContain("active_pending_overdue");
    expect(sql).toContain("i.sla_due_at < now()");
    expect(sql).toContain("nullif(btrim(i.next_action), '') is null");
    expect(sql).toContain("nullif(btrim(i.assigned_team), '') is null");
  });

  it("preserves RLS and authorization boundaries", () => {
    expect(sql).toContain("with (security_invoker = true)");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("revoke all on public.whatsapp_business_intake_reconciliation_exceptions from public");
    expect(sql).toContain("revoke all on function public.get_whatsapp_business_intake_reconciliation_exceptions() from anon");
    expect(sql).toContain("grant execute on function public.get_whatsapp_business_intake_reconciliation_exceptions() to authenticated");
  });

  it("provides deterministic operator ordering and additive programme counts", () => {
    expect(sql).toContain("case exception_class when 'breach' then 0 when 'overdue' then 1 else 2 end");
    expect(sql).toContain("sla_due_at nulls last");
    expect(sql).toContain("with per_intake_exception as");
    expect(sql).toContain("min(");
    expect(sql).toContain("group by intake_id");
    expect(sql).toContain("count(*) filter (where e.severity_rank = 0)");
    expect(sql).toContain("count(e.intake_id)::bigint as total_exception_intakes");
    expect(sql).not.toContain("count(distinct e.intake_id) filter");
  });

  it("does not write operational or intake truth", () => {
    expect(sql).not.toMatch(/insert\s+into/);
    expect(sql).not.toMatch(/update\s+public\./);
    expect(sql).not.toMatch(/delete\s+from/);
    expect(sql).not.toMatch(/create\s+trigger/);
    expect(sql).not.toMatch(/\b(orders|order_items|finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
