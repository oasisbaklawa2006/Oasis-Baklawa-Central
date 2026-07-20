import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719084000_wa_controlled_contextual_alias_learning.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp controlled contextual alias learning", () => {
  it("keeps alias learning contextual, owned, due, and human governed", () => {
    expect(sql).toContain("create table public.whatsapp_contextual_aliases");
    expect(sql).toContain("alias_kind in ('customer', 'product')");
    expect(sql).toContain(
      "context_type in ('contact', 'phone', 'conversation', 'commercial_customer')",
    );
    expect(sql).toContain("whatsapp_contextual_alias_owner_required");
    expect(sql).toContain("due_at timestamptz not null");
    expect(sql).toContain("status in ('pending', 'approved', 'rejected')");
    expect(sql).not.toContain("'global'");
  });

  it("requires evidence and explicit terminal decisions", () => {
    expect(sql).toContain("non-empty proposal evidence is required");
    expect(sql).toContain("non-empty decision evidence is required");
    expect(sql).toContain("rejection reason is required");
    expect(sql).toContain("contextual alias is already terminal");
    expect(sql).toContain("whatsapp_contextual_alias_terminal_shape");
  });

  it("is idempotent for the same target and rejects contextual collisions", () => {
    expect(sql).toContain("whatsapp_contextual_alias_one_live_mapping_idx");
    expect(sql).toContain("existing_row.target_entity_id <> p_target_entity_id");
    expect(sql).toContain("contextual alias already maps to a different target");
    expect(sql).toContain("return existing_row.id");
  });

  it("uses authorization, row locking, immutable audit, and direct-write denial", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql.match(/security definer/g) ?? []).toHaveLength(2);
    expect(sql.match(/for update/g) ?? []).toHaveLength(4);
    expect(sql).toContain("contextual_alias_proposed");
    expect(sql).toContain("contextual_alias_approved");
    expect(sql).toContain("contextual_alias_rejected");
    expect(sql).toContain(
      "revoke insert, update, delete, truncate on public.whatsapp_contextual_aliases from authenticated",
    );
  });

  it("does not mutate system-of-record or downstream truth", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
