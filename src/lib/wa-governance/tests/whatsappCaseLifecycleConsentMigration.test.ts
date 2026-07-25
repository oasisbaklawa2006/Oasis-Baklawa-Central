import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725210000_wa_case_lifecycle_consent_and_closure.sql",
  ),
  "utf8",
);

describe("WhatsApp lifecycle, consent, and closure governance", () => {
  it("records versioned consent, opt-out, quiet hours, and frequency", () => {
    expect(migration).toContain("create table public.whatsapp_communication_preferences");
    expect(migration).toContain("'OPTED_IN', 'OPTED_OUT'");
    expect(migration).toContain("quiet_hours_start time");
    expect(migration).toContain("max_messages_per_day integer");
    expect(migration).toContain("effective_from timestamptz not null");
  });

  it("blocks release against recipient preferences", () => {
    expect(migration).toContain("recipient has opted out of this communication class");
    expect(migration).toContain("outbound release falls within recipient quiet hours");
    expect(migration).toContain("recipient daily communication frequency limit reached");
  });

  it("records selective operational milestones without mutating orders", () => {
    expect(migration).toContain("create table public.whatsapp_case_milestone_events");
    expect(migration).toContain("'SILENT', 'OPTIONAL', 'REQUIRED'");
    expect(migration).toContain("related_milestone_event_id uuid");
    expect(migration).not.toMatch(/update\s+public\.orders/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.orders/i);
  });

  it("fails closed on incomplete case closure", () => {
    expect(migration).toContain("create table public.whatsapp_case_closures");
    expect(migration).toContain("case cannot close with open clarification");
    expect(migration).toContain("case cannot close with open departmental work");
    expect(migration).toContain("case cannot close with unresolved escalation");
  });

  it("keeps lifecycle evidence append-only and reader-only", () => {
    expect(migration).toContain("WhatsApp lifecycle evidence is append-only");
    expect(migration).toContain("for select to authenticated");
    expect(migration).not.toMatch(/for all to authenticated/i);
  });
});
