import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725150000_wa_canonical_communication_case_foundation.sql",
  ),
  "utf8",
);

describe("canonical WhatsApp communication-case migration", () => {
  it("creates one case linked to a durable packet and not directly to a live order", () => {
    expect(migration).toContain("create table public.whatsapp_communication_cases");
    expect(migration).toContain(
      "packet_id uuid not null references public.whatsapp_message_packets",
    );
    expect(migration).not.toMatch(/\border_id uuid\b/);
    expect(migration).not.toMatch(/references public\.orders/);
  });

  it("separates the identity triad", () => {
    expect(migration).toContain("create table public.whatsapp_case_identities");
    expect(migration).toContain(
      "'SUBMITTING_SENDER', 'ORIGINAL_COMMUNICATOR', 'COMMERCIAL_CUSTOMER'",
    );
    expect(migration).toContain(
      "unique (case_id, identity_role)",
    );
  });

  it("keeps requested, interpreted, and proposed commercial meaning distinct", () => {
    expect(migration).toContain("create table public.whatsapp_case_requested_lines");
    expect(migration).toContain("create table public.whatsapp_case_interpretations");
    expect(migration).toContain("create table public.whatsapp_case_proposed_changes");
    expect(migration).toContain("verbatim_request text not null");
    expect(migration).toContain("requested_value jsonb");
    expect(migration).toContain("proposed_value jsonb not null");
  });

  it("never silently invents quantity or unit", () => {
    expect(migration).toContain(
      "quantity is not null or 'quantity' = any(unresolved_fields)",
    );
    expect(migration).toContain(
      "unit is not null or quantity is null or 'unit' = any(unresolved_fields)",
    );
    expect(migration).not.toMatch(/quantity[^,\n]*default\s+1\b/i);
  });

  it("requires versioned, attributable customer confirmation", () => {
    expect(migration).toContain("create table public.whatsapp_case_confirmations");
    expect(migration).toContain("unique (case_id, version)");
    expect(migration).toContain("recipient_identity_id uuid not null");
    expect(migration).toContain(
      "status = 'CONFIRMED' and source_message_id is not null and confirmed_at is not null",
    );
  });

  it("enforces append-only, idempotent case events and RLS", () => {
    expect(migration).toContain("create table public.whatsapp_case_events");
    expect(migration).toContain("unique (case_id, correlation_key)");
    expect(migration).toContain("before update or delete on public.whatsapp_case_events");
    expect(migration).toContain("whatsapp_case_events is append-only");
    expect(migration).toContain(
      "alter table public.whatsapp_communication_cases enable row level security",
    );
    expect(migration).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
  });
});
