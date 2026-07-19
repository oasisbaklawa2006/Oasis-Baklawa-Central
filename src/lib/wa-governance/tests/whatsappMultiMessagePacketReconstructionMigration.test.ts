import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260720013000_wa_multi_message_packet_reconstruction.sql",
  "utf8",
);

describe("WhatsApp multi-message packet reconstruction migration", () => {
  it("groups only inbound messages into deterministic five-minute packets", () => {
    expect(migration).toContain("where m.direction = 'inbound'");
    expect(migration).toContain("created_at - previous_message_at > interval '5 minutes'");
    expect(migration).toContain("order by m.created_at, m.id");
    expect(migration).toContain("first_value(message_id)");
    expect(migration).toContain("packet_anchor_message_id");
  });

  it("preserves ordered message and governed-intake lineage", () => {
    expect(migration).toContain(
      "array_agg(p.message_id order by p.created_at, p.message_id) as source_message_ids",
    );
    expect(migration).toContain(
      "array_agg(i.id order by p.created_at, p.message_id)",
    );
    expect(migration).toContain("on i.source_message_id = p.message_id");
    expect(migration).toContain("and i.business_domain = 'B2B'");
    expect(migration).toContain("every_message_governed");
  });

  it("reconstructs text in source order and surfaces packet-level risk", () => {
    expect(migration).toContain(
      "string_agg(nullif(btrim(p.content), ''), E'\\n' order by p.created_at, p.message_id)",
    );
    expect(migration).toContain("contains_order_or_risk");
    expect(migration).toContain("contains_unaccounted_intake");
    expect(migration).toContain("message_count > 1");
    expect(migration).toContain("or not every_message_governed");
  });

  it("keeps all surfaces read-only and RLS-preserving", () => {
    expect(migration.match(/with \(security_invoker = true\)/g)).toHaveLength(2);
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain(
      "revoke all on public.whatsapp_inbound_message_packets from anon",
    );
    expect(migration).toContain(
      "grant execute on function public.get_whatsapp_inbound_message_packet_exceptions() to authenticated",
    );
  });

  it("contains no source, operational, or system-of-record writes", () => {
    const normalized = migration.toLowerCase();
    for (const forbidden of [
      "insert into public.whatsapp_messages",
      "update public.whatsapp_messages",
      "delete from public.whatsapp_messages",
      "insert into public.whatsapp_business_intakes",
      "update public.whatsapp_business_intakes",
      "insert into public.orders",
      "insert into public.order_items",
      "insert into public.sales_order_drafts",
      "insert into public.inventory",
      "insert into public.dispatch",
      "update public.orders",
    ]) {
      expect(normalized).not.toContain(forbidden);
    }
  });
});