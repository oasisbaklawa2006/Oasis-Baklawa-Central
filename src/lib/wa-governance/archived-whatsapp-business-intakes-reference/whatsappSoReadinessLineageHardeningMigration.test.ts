import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260719114500_wa_so_readiness_lineage_hardening.sql"),
  "utf8",
).toLowerCase();

describe("WhatsApp SO readiness lineage hardening", () => {
  it("anchors lineage and audit evidence to the exact inbound intake packet", () => {
    expect(sql).toContain("intake_row.packet_id");
    expect(sql).toContain("source_packet_id=excluded.source_packet_id");
    expect(sql).toContain("'source_packet_id',intake_row.packet_id");
    expect(sql).toContain("'draft_packet_id',draft_row.packet_id");
    expect(sql).toContain("'source_packet_mismatch',draft_row.packet_id is distinct from intake_row.packet_id");
    expect(sql).not.toContain("values(p_intake_id,p_sales_order_draft_id,draft_row.packet_id");
  });

  it("fails explicitly when exact inbound packet lineage is absent or orphaned", () => {
    expect(sql).toContain("if intake_row.packet_id is null then");
    expect(sql).toContain("whatsapp intake source packet is required for so readiness lineage");
    expect(sql).toContain("from public.whatsapp_message_packets");
    expect(sql).toContain("whatsapp intake source packet not found");
  });

  it("normalizes both requested and inherited team ownership", () => {
    expect(sql).toContain("nullif(btrim(p_assigned_team),'')");
    expect(sql).toContain("nullif(btrim(intake_row.assigned_team),'')");
    expect(sql).toContain("so readiness work must retain an owner");
  });

  it("preserves the actionable clarification prompt while clarification remains open", () => {
    expect(sql).toContain("open_clarification_exists := exists");
    expect(sql).toContain("when open_clarification_exists then intake_row.next_action");
    expect(sql).toContain("'open_clarification_preserved',open_clarification_exists");
  });

  it("retains authorization, locking, audit and downstream safety boundaries", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("for update");
    expect(sql).toContain("so_readiness_evaluated");
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
