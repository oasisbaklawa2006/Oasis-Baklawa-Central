import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719090000_wa_multimodal_failure_safe_intake.sql"),
  "utf8",
).toLowerCase();

describe("WhatsApp multimodal failure-safe intake", () => {
  it("captures every supported media form in a durable, owned, SLA-bound ledger", () => {
    expect(sql).toContain("create table public.whatsapp_multimodal_artifacts");
    for (const kind of ["voice", "image", "handwriting", "pdf", "payment_screenshot", "video", "caption"]) {
      expect(sql).toContain(kind);
    }
    expect(sql).toContain("whatsapp_multimodal_owner_required");
    expect(sql).toContain("due_at timestamptz not null");
    expect(sql).toContain("source_sha256");
    expect(sql).toContain("unique (intake_id, source_message_key, source_sha256)");
  });

  it("fails open to visible retry or human review work", () => {
    expect(sql).toContain("failed_retryable");
    expect(sql).toContain("failed_review_required");
    expect(sql).toContain("retryable failure requires next retry time");
    expect(sql).toContain("resolve every pending or failed media artifact; ai failure is visible human work.");
    expect(sql).toContain("multimodal_human_review_required");
  });

  it("requires evidence and prevents silent terminal states", () => {
    expect(sql).toContain("non-empty attempt evidence is required");
    expect(sql).toContain("successful extraction requires a non-empty result");
    expect(sql).toContain("explicit media closure requires a reason");
    expect(sql).toContain("multimodal artifact is already terminal");
    expect(sql).toContain("closed_by_user_id");
    expect(sql).toContain("closed_at");
  });

  it("preserves clarification priority and reconciles all governed ledgers", () => {
    expect(sql).toContain("open_clarification_count>0 then intake_row.next_action");
    expect(sql).toContain("from public.whatsapp_business_intake_clarifications");
    expect(sql).toContain("from public.whatsapp_business_intake_intents");
    expect(sql).toContain("from public.whatsapp_contextual_aliases");
    expect(sql).toContain("remaining_governed_work_count");
    expect(sql).toContain("min(due_at)");
  });

  it("uses authorization, parent-first locks, audit, RLS, and direct-write denial", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql.match(/security definer/g) ?? []).toHaveLength(2);
    const parentLock = sql.indexOf("from public.whatsapp_business_intakes", sql.indexOf("record_whatsapp_multimodal_outcome"));
    const childLock = sql.indexOf("from public.whatsapp_multimodal_artifacts", parentLock);
    expect(parentLock).toBeGreaterThan(-1);
    expect(childLock).toBeGreaterThan(parentLock);
    expect(sql).toContain("revoke insert, update, delete, truncate");
    expect(sql).toContain("whatsapp_business_intake_audit_log");
  });

  it("cannot mutate order, master, finance, dispatch, or inventory truth", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
