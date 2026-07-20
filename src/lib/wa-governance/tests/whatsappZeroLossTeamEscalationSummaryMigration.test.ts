import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260721020000_wa_zero_loss_team_escalation_summary.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss team escalation summary migration", () => {
  const sql = readMigration();

  it("groups only active-pending accountability work by normalized owner", () => {
    expect(sql).toContain("q.effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain("coalesce(nullif(btrim(q.assigned_team), ''), 'UNASSIGNED')");
    expect(sql).toContain("group by p.accountable_team");
  });

  it("counts critical, stale, unowned, actionless, and uniquely breached records", () => {
    expect(sql).toContain("p.priority_rank <= 20");
    expect(sql).toContain("p.is_stale");
    expect(sql).toContain("where p.missing_owner");
    expect(sql).toContain("where p.missing_next_action");
    expect(sql).toContain("where p.missing_owner or p.missing_next_action");
    expect(sql).not.toContain("missing_owner_count + missing_next_action_count");
  });

  it("keeps owned actionable stale work visible", () => {
    expect(sql).toContain("owned_actionable_stale_count");
    expect(sql).toMatch(/where p\.is_stale\s+and not p\.missing_owner\s+and not p\.missing_next_action/s);
  });

  it("prioritizes unassigned and highest-risk teams deterministically", () => {
    expect(sql).toContain("case when g.accountable_team = 'UNASSIGNED' then 0 else 1 end");
    expect(sql).toContain("g.unique_accountability_breach_count desc");
    expect(sql).toContain("g.stale_count desc");
    expect(sql).toContain("g.oldest_detected_at asc");
    expect(sql).toContain("g.accountable_team asc");
  });

  it("validates stale thresholds and restricts execution to inbox readers", () => {
    expect(sql).toContain("stale_after is null or stale_after <= interval '0 seconds'");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_zero_loss_team_escalation_summary(interval) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_zero_loss_team_escalation_summary(interval) to authenticated",
    );
  });

  it("does not mutate source or downstream operational truth", () => {
    for (const table of [
      "whatsapp_messages",
      "whatsapp_business_intakes",
      "whatsapp_authorized_channel_accountability_queue",
      "orders",
      "order_items",
      "sales_order_drafts",
      "payments",
      "invoices",
      "dispatches",
      "inventory",
    ]) {
      for (const verb of ["insert\\s+into", "update", "delete\\s+from", "truncate", "merge\\s+into"]) {
        expect(sql).not.toMatch(new RegExp(`${verb}\\s+(?:public\\.)?${table}`, "i"));
      }
    }
  });
});
