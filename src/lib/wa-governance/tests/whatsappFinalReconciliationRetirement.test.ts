import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const migration = read(
  "supabase/migrations/20260725230000_wa_final_reconciliation_and_retirement.sql",
);
const app = read("src/App.tsx");
const adminLayout = read("src/components/AdminLayout.tsx");
const banyan = read("supabase/functions/banyan-central-parser/index.ts");
const webhook = read("supabase/functions/whatsapp-webhook/index.ts");
const flags = read("supabase/functions/_shared/wa-governance/flags.ts");

describe("WhatsApp final reconciliation and controlled retirement", () => {
  it("records deterministic replay without commercial writes", () => {
    expect(migration).toContain("create table public.whatsapp_replay_runs");
    expect(migration).toContain("create table public.whatsapp_replay_results");
    expect(migration).toContain("'GOLDEN_FIXTURE', 'HISTORICAL_SAMPLE', 'INCIDENT_REPLAY'");
    expect(migration).toContain("commercial_writes_observed = 0");
    expect(migration).toContain("input_sha256");
    expect(migration).not.toMatch(/\b(insert into|update)\s+public\.(orders|order_items|companies)\b/i);
  });

  it("requires shift reconciliation and closes exceptions before signoff", () => {
    expect(migration).toContain("create table public.whatsapp_reconciliation_runs");
    expect(migration).toContain("create table public.whatsapp_reconciliation_exceptions");
    expect(migration).toContain(
      "shift reconciliation cannot be signed off with open exceptions",
    );
    expect(migration).toContain(
      "open exception cannot be added to or reopened on a signed-off reconciliation",
    );
    expect(migration).toContain("for update;");
    expect(migration).toContain(
      "before insert or update on public.whatsapp_reconciliation_exceptions",
    );
    expect(migration).toContain("'OUTBOUND_WITHOUT_DECISION'");
  });

  it("keeps learned aliases and patterns governed and attributable", () => {
    expect(migration).toContain("create table public.whatsapp_learning_candidates");
    expect(migration).toContain("inference_ruleset_version");
    expect(migration).toContain("'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED'");
    expect(migration).toContain("reviewed_by uuid");
    expect(migration).toContain("promoted_object_id uuid");
  });

  it("retires duplicate executable UI routes", () => {
    expect(app).toContain(
      '<Route path="central-pool" element={<Navigate to="/admin/operator-inbox" replace />} />',
    );
    expect(app).toContain(
      '<Route path="cmd-war-room" element={<Navigate to="/admin/operator-inbox" replace />} />',
    );
    expect(app).not.toContain('lazy(() => import("./pages/admin/CMDWarRoom.tsx"))');
    expect(adminLayout).not.toContain('to: "/admin/cmd-war-room"');
  });

  it("keeps Banyan retired and webhook commercial execution disabled", () => {
    const retirement = banyan.indexOf("Banyan independent WhatsApp lifecycle is retired");
    const serviceClient = banyan.indexOf("SUPABASE_SERVICE_ROLE_KEY");
    expect(retirement).toBeGreaterThan(-1);
    expect(serviceClient).toBeGreaterThan(retirement);
    expect(webhook).toContain("isWaWebhookAutoOrderWritesEnabled");
    expect(webhook).toContain("isWaWebhookOwnerReassignmentEnabled");
    expect(flags).toMatch(
      /function isWaWebhookAutoOrderWritesEnabled[\s\S]*?void getEnv;\s*return false;/,
    );
    expect(flags).toMatch(
      /function isWaWebhookOwnerReassignmentEnabled[\s\S]*?void getEnv;\s*return false;/,
    );
  });

  it("makes retirement and reconciliation evidence append-only and reader-only", () => {
    expect(migration).toContain("create table public.whatsapp_legacy_capability_retirements");
    expect(migration).toContain("commercial_write_authority boolean not null check (commercial_write_authority = false)");
    expect(migration).toContain("WhatsApp final reconciliation evidence cannot be deleted");
    expect(migration).toContain("WhatsApp legacy retirement evidence is append-only");
    expect(migration).toContain("supersedes_retirement_id uuid unique");
    expect(migration).toContain("unique (capability_key, revision_number)");
    expect(migration).toContain(
      "before update on public.whatsapp_legacy_capability_retirements",
    );
    expect(migration).toContain("for select to authenticated");
    expect(migration).not.toMatch(/for all to authenticated/i);
  });
});
