import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725180000_wa_case_formal_clarification.sql",
  ),
  "utf8",
);

describe("canonical WhatsApp formal clarification migration", () => {
  // Gate 9 must fail closed: unresolved meaning never advances commercial work.
  it("records each unresolved field and a targeted question", () => {
    expect(migration).toContain("create table public.whatsapp_case_clarifications");
    expect(migration).toContain("field_name text not null");
    expect(migration).toContain("unresolved_value jsonb");
    expect(migration).toContain("question text not null");
    expect(migration).toContain("field_name <> 'UNSPECIFIED'");
    expect(migration).toContain("'please clarify'");
  });

  it("requires an explicitly verified and authorised recipient", () => {
    expect(migration).toContain(
      "create table public.whatsapp_case_recipient_authorizations",
    );
    expect(migration).toContain("may_receive_clarification boolean not null");
    expect(migration).toContain("verification_method text not null");
    expect(migration).toContain("verified_by uuid not null");
    expect(migration).toContain("recipient_authorization_id uuid not null");
  });

  it("requires attributable answer evidence and a confirmer", () => {
    expect(migration).toContain("answer_source_message_id uuid");
    expect(migration).toContain("answered_by_identity_id uuid");
    expect(migration).toContain("confirmed_by uuid");
    expect(migration).toContain("answered_at timestamptz");
  });

  it("does not accept an unscoped yes as a resolved answer", () => {
    expect(migration).toContain(
      "whatsapp_case_clarifications_no_ambiguous_affirmation",
    );
    expect(migration).toContain(
      "lower(btrim(answer_text)) not in ('yes', 'y', 'ok', 'okay', 'confirmed', 'haan', 'ha')",
    );
  });

  it("stores idempotent, append-only follow-ups and escalation", () => {
    expect(migration).toContain(
      "create table public.whatsapp_case_clarification_followups",
    );
    expect(migration).toContain("'REMINDER_SENT', 'OWNER_ESCALATED'");
    expect(migration).toContain(
      "unique (clarification_id, correlation_key)",
    );
    expect(migration).toContain(
      "whatsapp_case_clarification_followups is append-only",
    );
  });

  it("blocks draft readiness while clarification remains unresolved", () => {
    expect(migration).toContain(
      "create or replace function public.guard_whatsapp_case_ready_for_draft",
    );
    expect(migration).toContain(
      "new.status = 'READY_FOR_DRAFT'",
    );
    expect(migration).toContain(
      "clarification.status = 'OPEN'",
    );
    expect(migration).toContain(
      "case interpretation still contains unresolved fields",
    );
  });

  it("enables RLS without authenticated direct mutation", () => {
    expect(migration).toContain(
      "alter table public.whatsapp_case_clarifications enable row level security",
    );
    expect(migration).toContain(
      "for select to authenticated using (public.is_whatsapp_inbox_reader(auth.uid()))",
    );
    expect(migration).not.toMatch(/for all to authenticated/i);
  });
});
