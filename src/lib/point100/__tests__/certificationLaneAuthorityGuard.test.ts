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
    // Exactly three negative probes, unconditional (the tail already refuses a non-separated Core).
    expect(tail.match(/await expectRejected\(/g)?.length).toBe(3);
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
});
