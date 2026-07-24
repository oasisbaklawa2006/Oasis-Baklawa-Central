import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719143000_wa_zero_loss_sla_management_dashboard.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp zero-loss SLA management dashboard", () => {
  it("keeps the programme accounting equation visible", () => {
    expect(sql).toContain("potential_received");
    expect(sql).toContain("converted");
    expect(sql).toContain("active_pending");
    expect(sql).toContain("explicitly_closed");
    expect(sql).toContain("unaccounted_potential_orders");
  });

  it("uses deterministic, non-overlapping SLA buckets", () => {
    expect(sql).toContain("overdue_24h_plus");
    expect(sql).toContain("overdue_under_24h");
    expect(sql).toContain("due_within_4h");
    expect(sql).toContain("on_track");
    expect(sql).toContain("i.sla_due_at < now() - interval '24 hours'");
    expect(sql).toContain("i.sla_due_at <= now() + interval '4 hours'");
  });

  it("surfaces ownership and derived breach risk", () => {
    expect(sql).toContain("owner_missing_intakes");
    expect(sql).toContain("breach_intakes");
    expect(sql).toContain("whatsapp_business_intake_reconciliation_exceptions");
    expect(sql).toContain("e.exception_class = 'breach'");
  });

  it("preserves authorization and source RLS", () => {
    expect(sql).toContain("with (security_invoker = true)");
    expect(sql).toContain("revoke all on public.whatsapp_business_intake_sla_management_dashboard from public");
    expect(sql).toContain("revoke all on public.whatsapp_business_intake_sla_management_dashboard from anon");
    expect(sql).toContain("grant select on public.whatsapp_business_intake_sla_management_dashboard to authenticated");
  });

  it("is read-only and avoids protected operational truth", () => {
    expect(sql).not.toMatch(/insert\s+into/);
    expect(sql).not.toMatch(/update\s+public\./);
    expect(sql).not.toMatch(/delete\s+from/);
    expect(sql).not.toMatch(/create\s+trigger/);
    expect(sql).not.toMatch(/\b(orders|order_items|finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
