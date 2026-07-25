import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725220000_wa_case_sensitive_intake_and_manual_queues.sql",
  ),
  "utf8",
);

describe("WhatsApp sensitive intake and manual queues", () => {
  it("keeps B2C and D2C messages active with owned manual follow-up", () => {
    expect(migration).toContain("create table public.whatsapp_case_manual_assignments");
    expect(migration).toContain("'B2C', 'D2C', 'UNRESOLVED'");
    expect(migration).toContain("assigned_sales_user_id uuid not null");
    expect(migration).toContain("due_at timestamptz not null");
    expect(migration).toContain("'ESCALATED'");
  });

  it("masks and quarantines harmful or commercially sensitive evidence", () => {
    expect(migration).toContain("create table public.whatsapp_case_restricted_evidence");
    expect(migration).toContain("'HARMFUL_CONTENT'");
    expect(migration).toContain("public_mask text not null");
    expect(migration).toContain("'FINANCE_ONLY', 'SECURITY_ONLY', 'LEGAL_ONLY'");
    expect(migration).toContain("restricted WhatsApp evidence cannot be deleted");
  });

  it("separates payment-proof receipt from finance verification", () => {
    expect(migration).toContain("create table public.whatsapp_case_payment_proofs");
    expect(migration).toContain("'RECEIVED', 'UNDER_REVIEW', 'VERIFIED'");
    expect(migration).toContain("payment proof receipt is not finance verification");
    expect(migration).not.toMatch(/insert\s+into\s+public\.order_payments/i);
  });

  it("tracks customer-approved migration to the official channel", () => {
    expect(migration).toContain("create table public.whatsapp_case_channel_migrations");
    expect(migration).toContain("'CUSTOMER_ACKNOWLEDGED', 'MIGRATED'");
    expect(migration).toContain("customer_ack_message_id uuid");
  });

  it("does not expose restricted evidence through ordinary reader policy", () => {
    expect(migration).not.toMatch(
      /whatsapp_case_restricted_evidence[\s\S]{0,200}for select to authenticated/i,
    );
    expect(migration).not.toMatch(/for all to authenticated/i);
  });
});
