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
    // Five unconditional staff-role probes (the tail already refuses a non-separated Core): Dispatch->Gate release,
    // Gate->proof, Gate->finalize, Dispatch->final invoice, Gate->Finance clearance; plus the journey-only Buyer->finalize
    // probe. The count reported in the ledger is the number that actually ran, never a hard-coded "five".
    expect(tail.match(/await expectRejected\(/g)?.length).toBe(6);
    expect(tail).toContain("rejectedProbeCount");
    expect(tail).not.toMatch(/\(5 negative authority probes/);
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

  describe("Buyer-to-Dispatch journey is governed-only: no business-table bypass, no synthetic evidence, no fallback", () => {
    const JOURNEY_SHA = "4e821518089ada8fa60cc0b7e115a291f856c68d";
    const journeyFiles = [
      "scripts/integration-certification/buyer-order-journey.mjs",
      "scripts/integration-certification/governed-production-leg.mjs",
      "scripts/integration-certification/verify-buyer-to-dispatch-journey.mjs",
      "scripts/integration-certification/journey-ledger.mjs",
      "scripts/integration-certification/start-ephemeral.sh",
    ];
    const WRITE = /\.(insert|upsert|update|delete)\(/;

    it("creates the order only through Core's quoted checkout and PI authority", () => {
      const buyer = read("scripts/integration-certification/buyer-order-journey.mjs");
      for (const rpc of ["customer_checkout_quote_v1", "submit_customer_order_quoted_v1", "create_sales_order_proforma_invoice_v1"]) {
        expect(buyer).toContain(rpc);
      }
      expect(buyer).not.toMatch(WRITE);
      expect(buyer).not.toContain("submit_customer_order_v1");
      expect(buyer).not.toMatch(/cleared_for_dispatch|status:\s*"/);
    });

    it("no journey file writes a business table, forces an order status, or reuses the Factory seeded order", () => {
      for (const file of journeyFiles) {
        const text = read(file);
        expect(text, file).not.toMatch(WRITE);
        expect(text, file).not.toMatch(/UPDATE\s+public\.orders/i);
        expect(text, file).not.toMatch(/SET\s+status\s*=/i);
        expect(text, file).not.toContain("seed-production-fixtures");
      }
      expect(read("scripts/integration-certification/start-ephemeral.sh")).toContain("FACTORY_CERT_P38_GOVERNED_CHAIN=false");
    });

    it("verification is read-only and requires governed completion events and authoritative Gate evidence", () => {
      const verify = read("scripts/integration-certification/verify-buyer-to-dispatch-journey.mjs");
      expect(verify).toContain('"dispatched"');
      // The Buyer denial runs in the tail at cleared_for_dispatch; the verifier checks it from the ledger and never signs a Buyer in.
      expect(verify).toContain("JOURNEY_BUYER_DENIAL_PROBE_MISSING");
      expect(verify).toContain("JOURNEY_BUYER_DENIAL_NOT_BEFORE_FINALIZATION");
      expect(verify).toContain("DISPATCH_FINALIZATION_ACTOR_REQUIRED");
      expect(verify).not.toContain("updateUserById");
      expect(verify).not.toContain("signInWithPassword");
      expect(verify).toContain("items?.length !== 1 || items[0].id !== orderItemId");
      expect(verify).toMatch(/^\s*assertNoError\(unsupportedError\b/m);
      expect(verify).toContain('outcomes.join(",") !== "PARTIAL,COMPLETE"');
      expect(verify).toContain("JOURNEY_GATE_EVIDENCE_NOT_AUTHORITATIVE");
      expect(verify).toContain("B2B_GATE_SCAN_V1");
    });

    it("status transitions and production completion come from Core RPCs, with no table write and no fallback", () => {
      const exit = read("scripts/point100-certification/prepare-point38-canonical-exit.mjs");
      expect(exit).toContain('process.env.POINT38_JOURNEY_GOVERNED_STATUS_PATH === "true"');
      for (const rpc of [
        "release_order_to_manufacturing_v1",
        "release_order_to_in_production_v1",
        "release_order_to_packed_ready_v1",
        "clear_order_for_dispatch_v1",
        "declare_b2b_dispatch_source_handoff",
      ]) {
        expect(exit).toContain(rpc);
      }
      expect(exit).toContain("runGovernedProductionLeg");
      expect(exit).not.toMatch(WRITE);
      expect(exit).not.toMatch(/staff table write|NOT a governed RPC|falling back|fallback to/i);
      // A blocked production leg must fail the journey: nothing may catch JOURNEY_PRODUCTION_BLOCKED_*.
      expect(exit).not.toContain("JOURNEY_PRODUCTION_BLOCKED_");
    });

    it("the production leg uses the governed pipeline end to end and never fabricates accepted evidence", () => {
      const leg = read("scripts/integration-certification/governed-production-leg.mjs");
      for (const rpc of [
        "reserve_rgs_stock",
        "create_production_shortage_demand",
        "accept_production_job",
        "record_production_output",
        "declare_production_ready",
        "dispatch_production_to_rgs",
        "record_rgs_receipt",
        "accept_rgs_production_receipt",
        "complete_order_item_from_production_v1",
      ]) {
        expect(leg).toContain(rpc);
      }
      expect(leg).toContain("JOURNEY_PRODUCTION_BLOCKED_STOCK_COVERED");
    });

    it("the Buyer denial is exercised at cleared_for_dispatch with Core's specific actor denial", () => {
      const tail = read("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
      const buyerProbe = tail.indexOf("BUYER must not finalize dispatch");
      const finalize = tail.indexOf("Point38 tail canonical dispatch finalization");
      expect(buyerProbe).toBeGreaterThan(-1);
      expect(buyerProbe).toBeLessThan(finalize);
      expect(tail).toContain('"DISPATCH_FINALIZATION_ACTOR_REQUIRED"');
      expect(tail).toContain("after the Buyer probe");
    });

    it("lookups fail closed and the ledger is written atomically", () => {
      const buyer = read("scripts/integration-certification/buyer-order-journey.mjs");
      expect(buyer).toMatch(/^\s*assertNoError\(stockError\b/m);
      expect(buyer).toMatch(/^\s*assertNoError\(prodError\b/m);
      expect(buyer).toContain("JOURNEY_FINANCE_ACTOR_MISSING");
      expect(buyer).toContain("Journey clear draft after rejected candidate");
      const leg = read("scripts/integration-certification/governed-production-leg.mjs");
      expect(leg).toMatch(/^\s*assertNoError\(balanceError\b/m);
      expect(leg).toContain("JOURNEY_PRODUCTION_HELD_STOCK_NOT_EXERCISED");
      const ledger = read("scripts/integration-certification/journey-ledger.mjs");
      expect(ledger).toContain("renameSync");
      expect(ledger.match(/writeFileSync\(/g)).toHaveLength(1);
    });

    it("the wrapper never enables the destructive local reset by default", () => {
      const wrapper = read("scripts/integration-certification/start-ephemeral.sh");
      expect(wrapper).toContain('POINT100_ALLOW_LOCAL_RESET:?');
      expect(wrapper).not.toMatch(/POINT100_ALLOW_LOCAL_RESET:-/);
      expect(wrapper).toContain('!= "true"');
    });

    it("the prepare/tail scripts reach custody and Gate state only through governed RPCs", () => {
      const prepare = read("scripts/point100-certification/prepare-point38-canonical-exit.mjs");
      const tail = read("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
      for (const rpc of ["declare_b2b_dispatch_source_handoff", "record_b2b_dispatch_handoff_receipt", "accept_b2b_dispatch_handoff", "open_b2b_dispatch_carton"]) {
        expect(prepare).toContain(`rpc("${rpc}"`);
      }
      // No update/upsert/delete anywhere; the only insert in either script is the REJECTED direct-insert probe.
      for (const script of [prepare, tail]) {
        expect(script).not.toMatch(/\.(update|upsert|delete)\(/);
      }
      expect(prepare).not.toMatch(/\.insert\(/);
      expect(tail.match(/\.insert\(/g)).toHaveLength(1);
      expect(tail).toContain("B2B_GATE_SCAN_DIRECT_INSERT_FORBIDDEN");
    });

    it("the ledger credits only the payment RPCs the run executed", () => {
      const prepare = read("scripts/point100-certification/prepare-point38-canonical-exit.mjs");
      expect(prepare).toContain("advanceProofExecuted");
      expect(prepare).toContain("clearanceDecisionExecuted");
      expect(prepare).not.toContain("Advance payment proof recorded and verified; operations clearance GRANTED");
    });

    it("the RGS reservation names its exact source order line, as Core's factory lineage authority requires", () => {
      const leg = read("scripts/integration-certification/governed-production-leg.mjs");
      const call = leg.slice(leg.indexOf('rpc("reserve_rgs_stock"'), leg.indexOf("Journey RGS reservation"));
      expect(call).toContain('p_demand_source_type: "b2b"');
      expect(call).toContain("p_demand_reference: `order_item:${orderItem.id}`");
      // The line id comes from the Buyer-created order; a missing id fails the journey, never a synthetic reference.
      expect(leg).toContain("JOURNEY_PRODUCTION_BLOCKED_ORDER_LINE");
      expect(leg).not.toMatch(/order_item:\$\{(?!orderItem\.id)/);
    });

    it("Gate evidence is recorded only by record_b2b_dispatch_gate_scan_v1, after the carton is ready_to_load", () => {
      const tail = read("scripts/point100-certification/finalize-point38-canonical-tail.mjs");
      expect(tail).toContain("record_b2b_dispatch_gate_scan_v1");
      for (const code of [
        "B2B_GATE_SCAN_DIRECT_INSERT_FORBIDDEN",
        "B2B_GATE_SCAN_BARCODE_MISMATCH",
        "B2B_GATE_SCAN_CARTON_NOT_FOUND",
        "B2B_GATE_SCAN_DUPLICATE",
        "B2B_GATE_SCAN_IDEMPOTENCY_CONFLICT",
      ]) {
        expect(tail).toContain(code);
      }
      expect(tail.indexOf('rpc("record_b2b_dispatch_gate_scan_v1"')).toBeGreaterThan(tail.indexOf("mark_b2b_dispatch_carton_ready_to_load_v1"));
      // The harness never writes scan evidence; the single operational_scan_records reference is a probe that must be REJECTED.
      expect(tail).not.toMatch(/\.update\(/);
      const inserts = tail.match(/\.insert\(/g) ?? [];
      expect(inserts).toHaveLength(1);
      expect(tail).toContain("Gate session must not insert evidence directly");
    });

    it("the journey's product fixture is fixture-only: loopback, two rule tables, refuses stock, run only by the journey", () => {
      const seed = read("scripts/factory-certification/seed-journey-buyer-product.mjs");
      expect(seed).toContain("createLocalSupabaseAdminClient");
      // It may only INSERT price and MOQ rules (the same rows the shared fixture gives CERT-ARABIC-001); nothing else is written.
      const writes = [...seed.matchAll(/\.from\("([a-z_]+)"\)\s*\.(insert|upsert|update|delete)\(/g)].map((m) => `${m[1]}.${m[2]}`);
      expect(writes.sort()).toEqual(["product_moq_rules.insert", "product_pricing_rules.insert"]);
      // Reading stock to refuse a product that has some is required; writing it is never allowed.
      expect(seed).toContain('.from("inventory_stock_balances")');
      expect(seed).not.toMatch(/\.from\("inventory_[a-z_]+"\)\s*\.(insert|upsert|update|delete)\(/);
      // Stock is never altered to qualify a product: a product with stock on hand fails the step.
      expect(seed).toContain("JOURNEY_FIXTURE_PRODUCT_HAS_STOCK");
      expect(seed).toContain("20000000-0000-4000-8000-000000000104");
      // Only the journey runs it; the shared Factory lane and its workflow do not.
      expect(read("scripts/integration-certification/start-ephemeral.sh")).toContain("seed-journey-buyer-product.mjs");
      expect(read("scripts/factory-certification/start-ephemeral.sh")).not.toContain("seed-journey-buyer-product");
      expect(read(".github/workflows/factory-certification-ephemeral.yml")).not.toContain("seed-journey-buyer-product");
    });

    it("no removed fixture, mode switch or combined-lane variant remains anywhere in the lane", () => {
      const lane = [
        ...journeyFiles,
        "scripts/point100-certification/prepare-point38-canonical-exit.mjs",
        "scripts/point100-certification/finalize-point38-canonical-tail.mjs",
        "tests/point100/canonicalDispatchTail.ts",
        ".github/workflows/buyer-to-dispatch-journey.yml",
      ];
      for (const file of lane) {
        const text = read(file);
        for (const banned of [
          "POINT38_GATE_SCAN_MODE",
          "JOURNEY_CORE_CONTRACTS",
          "legacyPinnedSyntheticGateFixture",
          "POINT100_PRE507_LEGACY_FIXTURE_ONLY",
          "disposable_synthetic_pre507_only",
          "point100_disposable_synthetic_gate",
          "synthetic-gate-scan",
        ]) {
          expect(text, `${file} still contains ${banned}`).not.toContain(banned);
        }
      }
      expect(() => read(".github/workflows/buyer-to-dispatch-journey-combined-core.yml")).toThrow();
    });

    it("the journey workflow is non-production, pinned to the exact Core SHA, and guards run before the backend", () => {
      const wf = read(".github/workflows/buyer-to-dispatch-journey.yml");
      expect(wf).toContain("NON-PRODUCTION, CI-VERIFIED ONLY");
      expect(wf).toContain(`JOURNEY_CORE_SHA: ${JOURNEY_SHA}`);
      expect(wf).toContain(`POINT100_CORE_VERIFIED_SHA: ${JOURNEY_SHA}`);
      expect(wf).toContain("needs: static-guards");
      expect(wf).not.toMatch(/POINT100_DISPATCH_PRODUCTION_VERIFIED:\s*"?true/);
      expect(wf).not.toContain("POINT100_PRODUCTION_CERTIFICATION_PERMITTED");
      // The production-evidence report is informational only: it must never gate the job or invent a run id.
      expect(wf).toContain("continue-on-error: true");
      expect(wf).not.toContain("POINT100_PRODUCTION_MIGRATION_RUN_ID");
      expect(wf).toContain("ref: ${{ env.JOURNEY_CORE_SHA }}");
    });

    it("the declared Core pin is identical in the journey, the production-bound lane, the recert runner and the library", () => {
      const sha = (text: string, label: string) => {
        const found = text.match(/[0-9a-f]{40}/g) ?? [];
        expect(new Set(found).size, `${label} must pin exactly one SHA`).toBe(1);
        return found[0];
      };
      const lane = read(".github/workflows/point100-certification-ephemeral.yml");
      const laneShas = lane.match(/POINT100_CORE_VERIFIED_SHA(?::|}")?[ =]*"?([0-9a-f]{40})/g) ?? [];
      expect(laneShas.length).toBeGreaterThan(0);
      for (const hit of laneShas) expect(hit).toContain(JOURNEY_SHA);
      expect(sha(read("scripts/point100-certification/recert-after-core-260.sh").split("\n").filter((l) => /POINT100_CORE_VERIFIED_SHA|Core main exact SHA/.test(l)).join("\n"), "recert runner")).toBe(JOURNEY_SHA);
      expect(read("src/lib/point100/upstreamDependencies.ts")).toContain(`POINT100_CORE_PRODUCTION_VERIFIED_SHA = "${JOURNEY_SHA}"`);
    });

    it("never asserts a production release run id for the declared pin", () => {
      const lib = read("src/lib/point100/upstreamDependencies.ts");
      expect(lib).not.toContain("41361801135");
      expect(lib).toContain('POINT100_PRODUCTION_RELEASE_PENDING = "pending-protected-release"');
      expect(read(".github/workflows/point100-certification-ephemeral.yml")).toContain("POINT100_PRODUCTION_RELEASE_NOT_CERTIFIED");
    });
  });
});
