import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725173000_wa_case_accountability_and_handoffs.sql",
  ),
  "utf8",
);

describe("canonical WhatsApp case accountability migration", () => {
  it("requires one accountable team and owner with a time-bound next action", () => {
    expect(migration).toContain("accountability_status text not null");
    expect(migration).toContain("accountable_team is not null");
    expect(migration).toContain("accountable_owner_id is not null");
    expect(migration).toContain("next_action is not null");
    expect(migration).toContain("next_action_due_at is not null");
  });

  it("models departmental work as contribution without transferring accountability", () => {
    expect(migration).toContain(
      "create table public.whatsapp_case_department_tasks",
    );
    expect(migration).toContain("department text not null");
    expect(migration).toContain("due_at timestamptz not null");
    expect(migration).toContain("response_payload jsonb");
    expect(migration).toContain(
      "these tasks never replace the case accountable response owner",
    );
  });

  it("requires explicit accepted handoffs with an open-work snapshot", () => {
    expect(migration).toContain("create table public.whatsapp_case_handoffs");
    expect(migration).toContain("from_owner_id uuid not null");
    expect(migration).toContain("to_owner_id uuid not null");
    expect(migration).toContain("open_work_snapshot jsonb not null");
    expect(migration).toContain("accepted_by uuid not null");
    expect(migration).toContain("accepted_at timestamptz not null");
  });

  it("keeps handoffs append-only and all retryable operations idempotent", () => {
    expect(migration).toContain("whatsapp_case_handoffs is append-only");
    expect(migration).toContain(
      "unique (case_id, correlation_key)",
    );
    expect(migration).toContain(
      "whatsapp_case_department_tasks_correlation_unique",
    );
    expect(migration).toContain(
      "whatsapp_case_escalations_correlation_unique",
    );
  });

  it("records escalation acknowledgement and resolution evidence", () => {
    expect(migration).toContain("create table public.whatsapp_case_escalations");
    expect(migration).toContain("escalation_level integer not null");
    expect(migration).toContain("acknowledged_by uuid");
    expect(migration).toContain("resolved_by uuid");
    expect(migration).toContain("resolution text");
  });

  it("enables RLS without granting authenticated mutation", () => {
    expect(migration).toContain(
      "alter table public.whatsapp_case_department_tasks enable row level security",
    );
    expect(migration).toContain(
      "for select to authenticated using (public.is_whatsapp_inbox_reader(auth.uid()))",
    );
    expect(migration).not.toMatch(/for all to authenticated/i);
  });
});
