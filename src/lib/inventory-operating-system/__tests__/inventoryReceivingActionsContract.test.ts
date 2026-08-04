import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  resolve(testDirectory, "../../../../supabase/migrations/20260805120000_phase3_inventory_receiving_actions.sql"),
  "utf8",
);

describe("Phase 3 governed inventory receiving actions", () => {
  it("separates physical receipt from authorised stock acceptance", () => {
    expect(sql).toContain("record_b2b_inventory_receipt");
    expect(sql).toContain("accept_b2b_inventory_receipt");
    expect(sql).toContain("status = 'received'");
    expect(sql).toContain("Receipt is not awaiting acceptance");
  });

  it("binds authority and authorship to the authenticated user", () => {
    expect(sql).toContain("v_actor_id uuid := auth.uid()");
    expect(sql).toContain("public.can_receive_b2b_inventory(v_actor_id)");
    expect(sql).toContain("received_by = v_actor_id");
    expect(sql).toContain("accepted_by = v_actor_id");
    expect(sql).not.toMatch(/p_actor_id|p_received_by|p_accepted_by/);
  });

  it("requires complete line reconciliation and prevents replay", () => {
    expect(sql).toContain("every receipt line exactly once");
    expect(sql).toContain("Every received unit must be accepted, damaged, or rejected");
    expect(sql).toContain("Receipt has already been recorded or closed");
    expect(sql).toContain("Receipt is not awaiting acceptance");
  });

  it("posts ledger and balance changes atomically with optimistic locking", () => {
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("Stale stock balance version");
    expect(sql).toContain("version = version + 1");
    expect(sql).toContain("INSERT INTO public.inventory_movements");
    expect(sql).toContain("'receiving_action', 'accepted'");
    expect(sql).toContain("An expected balance version is required");
    expect(sql).toContain("Stock balance update did not apply");
    expect(sql).toContain("sum((payload.value->>'accepted_qty')::numeric)");
    expect(sql).toContain("All accepted lines for stock balance");
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(sql).toMatch(/IF v_accepted > 0 AND v_expected_version IS NULL THEN/);
  });

  it("uses a fixed privileged search path and explicit function privileges", () => {
    expect(sql.match(/SECURITY DEFINER/g)).toHaveLength(2);
    expect(sql.match(/SET search_path = ''/g)).toHaveLength(2);
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.b2b_inventory_receipts");
  });
});
