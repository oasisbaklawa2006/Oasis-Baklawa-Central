import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260725200000_wa_case_outbound_communication_governance.sql",
  ),
  "utf8",
);

describe("canonical WhatsApp outbound communication governance", () => {
  it("records a governed purpose instead of treating every reply alike", () => {
    expect(migration).toContain(
      "create table public.whatsapp_case_outbound_decisions",
    );
    expect(migration).toContain("'RECEIPT_ACKNOWLEDGEMENT'");
    expect(migration).toContain("'CUSTOMER_CONFIRMATION_REQUEST'");
    expect(migration).toContain("'OPERATIONAL_MILESTONE'");
    expect(migration).toContain(
      "receipt acknowledgement cannot confirm commercial scope",
    );
  });

  it("fails closed on recipient and disclosure authority", () => {
    expect(migration).toContain("recipient_authorization_id uuid not null");
    expect(migration).toContain(
      "new.disclosure_scope <@ authorization.disclosure_scope",
    );
    expect(migration).toContain(
      "outbound recipient authorization has been revoked",
    );
    expect(migration).toContain(
      "recipient is not authorised for commercial confirmation",
    );
  });

  it("requires factual and communication-quality validation before release", () => {
    expect(migration).toContain(
      "create table public.whatsapp_case_reply_validations",
    );
    expect(migration).toContain("factual_consistency_status text not null");
    expect(migration).toContain("recipient_authority_status text not null");
    expect(migration).toContain("disclosure_status text not null");
    expect(migration).toContain("ambiguity_status text not null");
    expect(migration).toContain(
      "commercial_commitment_status <> 'UNAUTHORISED'",
    );
    expect(migration).toContain(
      "outbound reply has not passed every release validation",
    );
  });

  it("makes release and provider retry idempotent", () => {
    expect(migration).toContain(
      "unique (case_id, idempotency_key)",
    );
    expect(migration).toContain(
      "create table public.whatsapp_case_outbound_attempts",
    );
    expect(migration).toContain("unique (idempotency_key)");
    expect(migration).toContain(
      "decision.idempotency_key = new.idempotency_key",
    );
    expect(migration).toContain(
      "provider attempt requires the released outbound idempotency key",
    );
  });

  it("preserves validation and delivery evidence", () => {
    expect(migration).toContain(
      "whatsapp_case_reply_validations is append-only",
    );
    expect(migration).toContain(
      "whatsapp_case_outbound_attempts cannot be deleted",
    );
    expect(migration).toContain("provider_message_id text");
    expect(migration).toContain("'DELIVERED', 'READ', 'FAILED'");
  });

  it("enables RLS without authenticated direct mutation", () => {
    expect(migration).toContain(
      "alter table public.whatsapp_case_outbound_decisions enable row level security",
    );
    expect(migration).toContain(
      "for select to authenticated using (public.is_whatsapp_inbox_reader(auth.uid()))",
    );
    expect(migration).not.toMatch(/for all to authenticated/i);
  });
});
