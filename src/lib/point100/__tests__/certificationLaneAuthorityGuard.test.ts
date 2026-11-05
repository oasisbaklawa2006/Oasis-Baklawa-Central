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
    expect(script).toContain("20261001220000_gate_dispatch_role_separation.sql");
    expect(script).toContain("'dispatch_finalize'");
  });

  it("Point100 tail derives roles from the Core checkout and can stop before finalization", () => {
    const tail = read("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
    expect(tail).toContain("20261001220000_gate_dispatch_role_separation.sql");
    expect(tail).toContain("const proofRole = roleSeparated ? dispatchRole : gateRole;");
    expect(tail).toContain("POINT38_TAIL_STOP_BEFORE_FINALIZE");
    // Gate release stays with the independent Security Gate role in every mode.
    expect(tail).toMatch(/gateRole\.client\.rpc\("release_b2b_dispatch_carton_at_gate_v1"/);
    // Proof and finalization are never hard-wired to the Security Gate again.
    expect(tail).not.toMatch(/gateRole\.client\.rpc\("release_order_to_dispatched_v1"/);
    expect(tail).not.toMatch(/gateRole\.client\.rpc\("record_dispatch_proof_packet_v1"/);
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
