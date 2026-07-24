import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260720022000_wa_packet_accountability_queue.sql",
  "utf8",
);

describe("WhatsApp packet accountability queue migration", () => {
  it("joins packet lineage to the canonical accountability ledger", () => {
    expect(migration).toContain("public.whatsapp_inbound_message_packets p");
    expect(migration).toContain("unnest(coalesce(p.intake_ids, array[]::uuid[]))");
    expect(migration).toContain("public.whatsapp_business_intake_accountability_ledger l");
    expect(migration).toContain("l.intake_id = packet_intake.intake_id");
  });

  it("prioritizes capture and unaccounted failures before downstream exceptions", () => {
    expect(migration).toContain("when not p.every_message_governed then 'MESSAGE_CAPTURE_GAP'");
    expect(migration).toContain("when p.contains_unaccounted_intake then 'UNACCOUNTED_INTAKE'");
    expect(migration).toContain("when bool_or(l.accountability_state = 'OWNER_MISSING')");
    expect(migration).toContain("when bool_or(l.accountability_state = 'NEXT_ACTION_MISSING')");
    expect(migration).toContain("when bool_or(l.accountability_state = 'SLA_MISSING')");
    expect(migration).toContain("when bool_or(l.accountability_state = 'OVERDUE')");
  });

  it("preserves ownership, deadline, and reviewable accounted packet context", () => {
    expect(migration).toContain("accountable_user_ids");
    expect(migration).toContain("accountable_teams");
    expect(migration).toContain("earliest_pending_sla_due_at");
    expect(migration).toContain("'REVIEWABLE_ACCOUNTED_PACKET'");
    expect(migration).toContain("p.source_message_ids");
    expect(migration).toContain("p.reconstructed_text");
  });

  it("is authenticated, RLS-preserving, deterministic, and read-only", () => {
    expect(migration).toContain("with (security_invoker = true)");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("revoke all on public.whatsapp_inbound_packet_accountability_queue from anon");
    expect(migration).toContain("grant execute on function public.get_whatsapp_inbound_packet_accountability_queue() to authenticated");
    expect(migration).toContain("packet_last_message_at asc");
    expect(migration).toContain("packet_id;");

    const normalized = migration.toLowerCase();
    for (const forbidden of [
      "insert into public.whatsapp_messages",
      "update public.whatsapp_messages",
      "delete from public.whatsapp_messages",
      "insert into public.whatsapp_business_intakes",
      "update public.whatsapp_business_intakes",
      "insert into public.orders",
      "update public.orders",
      "insert into public.order_items",
      "insert into public.sales_order_drafts",
      "insert into public.finance",
      "insert into public.inventory",
      "insert into public.dispatch",
    ]) {
      expect(normalized).not.toContain(forbidden);
    }
  });
});
