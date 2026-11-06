import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Surface guard for the disposable certification lanes (Factory POINT-38 and Point100).
 *
 * The lanes must certify Core's own dispatch finalization authority, never a substitute:
 *  - the Factory seeder must not re-create Core's release_order_to_dispatched_v1 (a stale
 *    'gate_release' shim once overwrote it and made Dispatch finalization unreachable);
 *  - the Point100 authority script must only VERIFY, never re-apply an older Core migration
 *    over a later one;
 *  - the Point100 tail must pick Gate/Dispatch roles from the Core checkout under test.
 * These are source-level guards: they cannot replace the exact-head CI jobs.
 */
const root = resolve(__dirname, "../../../..");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

describe("certification lane dispatch-authority guard", () => {
  it("Factory seeder does not install a release_order_to_dispatched_v1 shim", () => {
    const seed = read("scripts/factory-certification/seed-production-fixtures.mjs");
    expect(seed).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.release_order_to_dispatched_v1/i);
    expect(seed).not.toMatch(/assert_order_transition_role\('gate_release'\)/);
  });

  it("Point100 authority script is verify-only and never re-applies a Core migration", () => {
    const script = read("scripts/point100-certification/restore-canonical-dispatch-authority.mjs");
    expect(script).not.toMatch(/execFileSync|migrationSql|readFile\([^)]*migrations/);
    expect(script).toContain("pg_get_functiondef");
    expect(script).toContain("POINT38_CORE_AUTHORITY_MODE");
    expect(script).toContain("'dispatch_finalize'");
  });

  it("Point100 tail derives roles from the Core checkout and can stop before finalization", () => {
    const tail = read("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
    expect(tail).toContain("POINT38_CORE_AUTHORITY_MODE");
    expect(tail).not.toMatch(/existsSync/);
    expect(tail).toContain("const proofRole = dispatchRole;");
    expect(tail).toContain("POINT100_POINT38_TAIL_REQUIRES_ROLE_SEPARATED_CORE");
    expect(tail).not.toContain("pre-separation");
    expect(tail).toContain("POINT38_TAIL_STOP_BEFORE_FINALIZE");
    // Gate release stays with the independent Security Gate role in every mode.
    expect(tail).toMatch(/gateRole\.client\.rpc\("release_b2b_dispatch_carton_at_gate_v1"/);
    // Real proof and finalization calls use proofRole (Dispatch when role-separated), never a hard-wired Gate.
    expect(tail).toContain('proofRole.client.rpc("release_order_to_dispatched_v1"');
    expect(tail).toContain('proofRole.client.rpc("record_dispatch_proof_packet_v1"');
    // The only Gate-role calls to those two RPCs are the single negative probe each (expected to be rejected).
    expect(tail.match(/gateRole\.client\.rpc\("release_order_to_dispatched_v1"/g)?.length).toBe(1);
    expect(tail.match(/gateRole\.client\.rpc\("record_dispatch_proof_packet_v1"/g)?.length).toBe(1);
  });

  it("role-separated runs assert the Gate/Dispatch separation negatively", () => {
    const tail = read("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
    expect(tail).toContain("independent security gate authority required");
    expect(tail).toContain("dispatch proof authority required");
    expect(tail).toContain("dispatch finalization authority required");
    expect(tail).toContain("POINT38_NEGATIVE_AUTHORIZATION_FAILED");
    expect(tail).toContain("POINT38_NEGATIVE_AUTHORIZATION_MUTATED_STATE");
    // Exactly five negative probes, unconditional (the tail already refuses a non-separated Core):
    // Dispatch->Gate release, Gate->proof, Gate->finalize, Dispatch->final invoice, Gate->Finance clearance.
    expect(tail.match(/await expectRejected\(/g)?.length).toBe(5);
    expect(tail).toContain("finance authority required");
    expect(tail).toContain('dispatchRole.client.rpc("issue_final_invoice_v1"');
    expect(tail).toContain('gateRole.client.rpc("decide_finance_dispatch_clearance_v1"');
  });

  it("the governed chain dates the final invoice by Core's IST business date, at every hour", () => {
    const exit = read("scripts/point100-certification/prepare-point38-canonical-exit.mjs");
    expect(exit).toContain("kolkataBusinessDateNow");
    // The stale UTC-session-date logic made the lane refuse to run between 18:30 and 24:00 UTC.
    expect(exit).not.toContain("sessionCalendarDate");
    expect(exit).not.toContain("isFinanceCalendarConflictImminent");
    expect(exit).not.toContain("POINT100_POINT38_FINANCE_CALENDAR_CONFLICT");
    // Core's own bounds stay enforced by the script: never earlier than the request's IST date.
    expect(exit).toContain("POINT100_POINT38_FINAL_INVOICE_DATE_UNRESOLVABLE");
  });

  it("Point100 specs require the explicit Gate rejection for Dispatch and keep proof/finalize with Dispatch", () => {
    const negative = read("tests/point100/negative-paths.cert.spec.ts");
    const step = negative.slice(negative.indexOf("dispatch manager cannot substitute the independent security gate"));
    expect(step).toContain("independent security gate authority required");
    expect(step).toContain(".not.toBeNull()");
    // The obsolete carton-level fail-closed assertion must not return for this actor.
    expect(step.slice(0, step.indexOf("duplicate scan correlation"))).not.toMatch(/toContain\("carton_not_found"\)/);
    const tail = read("tests/point100/canonicalDispatchTail.ts");
    expect(tail).toContain('dispatch.rpc("record_dispatch_proof_packet_v1"');
    expect(tail).toContain('dispatch.rpc("release_order_to_dispatched_v1"');
    expect(tail).not.toMatch(/gate\.rpc\("(record_dispatch_proof_packet_v1|release_order_to_dispatched_v1)"/);
  });

  it("authority mode comes from the Core checkout via one shared shell helper", () => {
    const helper = read("scripts/factory-certification/core-authority-mode.sh");
    expect(helper).toContain("20261001220000_gate_dispatch_role_separation.sql");
    expect(helper).toContain("role-separated");
    expect(helper).toContain("pre-separation");
    expect(read("scripts/factory-certification/start-ephemeral.sh")).toContain("core_authority_mode");
    expect(read("scripts/point100-certification/start-ephemeral.sh")).toContain("core_authority_mode");
  });

  it("Factory bootstrap builds the governed chain; Point100 opts out and builds its own", () => {
    const factory = read("scripts/factory-certification/start-ephemeral.sh");
    expect(factory).toContain("FACTORY_CERT_P38_GOVERNED_CHAIN");
    expect(factory).toContain("prepare-point38-canonical-exit.mjs");
    expect(factory).toContain("POINT38_TAIL_STOP_BEFORE_FINALIZE=true");
    const point100 = read("scripts/point100-certification/start-ephemeral.sh");
    expect(point100).toContain("FACTORY_CERT_P38_GOVERNED_CHAIN=false");
  });

  describe("Buyer-to-Dispatch journey does not manufacture business evidence", () => {
    const journeyFiles = [
      "scripts/integration-certification/buyer-order-journey.mjs",
      "scripts/integration-certification/verify-buyer-to-dispatch-journey.mjs",
      "scripts/integration-certification/start-ephemeral.sh",
    ];

    it("creates the order only through Core's quoted checkout, never by insert/update/upsert", () => {
      const buyer = read("scripts/integration-certification/buyer-order-journey.mjs");
      expect(buyer).toContain("customer_checkout_quote_v1");
      expect(buyer).toContain("submit_customer_order_quoted_v1");
      expect(buyer).toContain("create_sales_order_proforma_invoice_v1");
      expect(buyer).not.toMatch(/\.(insert|upsert|update)\(/);
      expect(buyer).not.toContain("submit_customer_order_v1");
      expect(buyer).not.toMatch(/cleared_for_dispatch|status:\s*"/);
    });

    it("verification is read-only (service role never writes business tables)", () => {
      const verify = read("scripts/integration-certification/verify-buyer-to-dispatch-journey.mjs");
      expect(verify).not.toMatch(/\.(insert|upsert|delete)\(/);
      expect(verify.match(/\.update\(/g)).toBeNull();
      expect(verify).toContain('"dispatched"');
      expect(verify).toContain("JOURNEY_BUYER_DISPATCH_AUTHORITY_NOT_REJECTED");
    });

    it("no journey file forces an order status with SQL or reuses the Factory seeded order", () => {
      for (const file of journeyFiles) {
        const text = read(file);
        expect(text, file).not.toMatch(/UPDATE\s+public\.orders/i);
        expect(text, file).not.toMatch(/SET\s+status\s*=/i);
        expect(text, file).not.toContain("seed-production-fixtures");
      }
      expect(read("scripts/integration-certification/start-ephemeral.sh")).toContain("FACTORY_CERT_P38_GOVERNED_CHAIN=false");
    });

    it("status transitions come from Core's own order authorities, gated to the journey lane only", () => {
      const exit = read("scripts/point100-certification/prepare-point38-canonical-exit.mjs");
      expect(exit).toContain('process.env.POINT38_JOURNEY_GOVERNED_STATUS_PATH === "true"');
      for (const rpc of [
        "release_order_to_manufacturing_v1",
        "release_order_to_in_production_v1",
        "release_order_to_packed_ready_v1",
        "clear_order_for_dispatch_v1",
      ]) {
        expect(exit).toContain(rpc);
      }
      // The only table write is the explicitly-labelled staff production completion under an authenticated role.
      expect(exit.match(/\.update\(/g)?.length).toBe(1);
      expect(exit).toContain("NOT a governed RPC");
      expect(read("scripts/integration-certification/start-ephemeral.sh")).toContain("POINT38_JOURNEY_GOVERNED_STATUS_PATH=true");
    });
  });

  describe("CP18 consumer adoption of Core #481 and #483", () => {
    it("the tail records Gate evidence through record_b2b_dispatch_gate_scan_v1 and only falls back when the RPC does not exist", () => {
      const tail = read("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
      expect(tail).toContain("record_b2b_dispatch_gate_scan_v1");
      expect(tail).toContain("POINT38_GATE_SCAN_MODE");
      expect(tail).toMatch(/gateScanMode === "rpc" \|\| !missing/);
      // the unauthorized/duplicate/wrong-carton/replay probes of the new contract
      for (const code of ["B2B_GATE_SCAN_DIRECT_INSERT_FORBIDDEN", "B2B_GATE_SCAN_BARCODE_MISMATCH", "B2B_GATE_SCAN_CARTON_NOT_FOUND", "B2B_GATE_SCAN_DUPLICATE", "B2B_GATE_SCAN_IDEMPOTENCY_CONFLICT"]) {
        expect(tail).toContain(code);
      }
      // Gate evidence is created after the carton is ready_to_load (the RPC enforces the physical-exit state)
      expect(tail.indexOf("await ensureGateScan()")).toBeGreaterThan(tail.indexOf("mark_b2b_dispatch_carton_ready_to_load_v1"));
    });

    it("the governed production leg writes no business table and never fabricates accepted evidence", () => {
      const leg = read("scripts/integration-certification/governed-production-leg.mjs");
      expect(leg).not.toMatch(/\.(insert|upsert|update|delete)\(/);
      for (const rpc of ["reserve_rgs_stock", "create_production_shortage_demand", "accept_production_job", "record_production_output",
        "declare_production_ready", "dispatch_production_to_rgs", "record_rgs_receipt", "accept_rgs_production_receipt", "complete_order_item_from_production_v1"]) {
        expect(leg).toContain(rpc);
      }
      expect(leg).toContain("JOURNEY_PRODUCTION_BLOCKED_STOCK_COVERED");
    });

    it("the combined-Core workflow is manual, non-production and independent of the protected-release pin", () => {
      const wf = read(".github/workflows/buyer-to-dispatch-journey-combined-core.yml");
      expect(wf).toContain("workflow_dispatch");
      expect(wf).not.toContain("pull_request");
      expect(wf).toContain("NON-PRODUCTION");
      expect(wf).toContain("POINT38_GATE_SCAN_MODE: rpc");
      expect(wf).toContain("JOURNEY_CORE_CONTRACTS: combined");
      expect(wf).not.toContain("POINT100_PRODUCTION_MIGRATION_RUN_ID");
    });
  });
});
