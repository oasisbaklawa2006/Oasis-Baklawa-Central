import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { deriveFinanceSignalFromSlices } from "../adapters/financeSignalAdapter";
import { deriveReadinessInputFromSlices } from "../adapters/readinessSignalAdapter";
import { deriveFinalizationInputFromSlices } from "../adapters/finalizationSignalAdapter";
import { completionAttestedIsNotDispatched } from "../adapters/completionSignalAdapter";
import { isStockFinalizationCandidate } from "../adapters/stockSignalAdapter";
import { deriveStockInputFromSlices } from "../adapters/stockSignalAdapter";
import { isPreviewFallbackEnabled, resolveBoardProjectionSource } from "../previewFallback";
import { emptyReadModelResult } from "../types";
import { projectDispatchReadiness } from "@/lib/dispatch-readiness";
import { reconcileReservationsForConsumption } from "@/lib/stock-finalization/stockReservationReconciliation";

describe("execution-read-models SELECT-only", () => {
  const root = join(process.cwd(), "src/lib/execution-read-models");
  const files = readdirSync(root, { recursive: true }).filter(
    (f) => typeof f === "string" && (f.endsWith(".ts") || f.endsWith(".tsx")),
  ) as string[];

  const forbidden = [".insert(", ".update(", ".delete(", ".upsert(", ".rpc(", "functions.invoke", "fetch("];

  for (const rel of files) {
    if (rel.includes("__tests__")) continue;
    const full = join(root, rel);
    const src = readFileSync(full, "utf8");
    for (const pattern of forbidden) {
      it(`${rel} must not contain ${pattern}`, () => {
        expect(src).not.toContain(pattern);
      });
    }
  }
});

describe("financeSignalAdapter", () => {
  it("unknown finance does not become ready", () => {
    const fusion = deriveFinanceSignalFromSlices(
      {
        orderId: "o1",
        orderValue: 100,
        advanceRequired: 0,
        advanceVerified: true,
        paymentStatus: null,
        updatedAt: null,
      },
      [],
    );
    expect(fusion.financeSignal).not.toBe("ready");
    expect(["unknown", "pending_review", "blocked"]).toContain(fusion.financeSignal);
  });

  it("rejected finance evidence blocks signal", () => {
    const fusion = deriveFinanceSignalFromSlices(
      {
        orderId: "o1",
        orderValue: 100,
        advanceRequired: 0,
        advanceVerified: true,
        paymentStatus: null,
        updatedAt: new Date().toISOString(),
      },
      [{ reviewStatus: "rejected", reviewType: "commercial_release", createdAt: new Date().toISOString() }],
    );
    expect(fusion.financeSignal).toBe("blocked");
  });
});

describe("readinessSignalAdapter", () => {
  it("unresolved scan mismatch blocks readiness", () => {
    const fusion = deriveReadinessInputFromSlices({
      orderId: "o1",
      reservationStatus: "reserved",
      financeSignal: "ready",
      financeMeta: { signalGeneratedAt: new Date().toISOString(), signalAgeMs: 0, stale: false },
      scan: {
        hasUnresolvedMismatch: true,
        hasRejectedGateScan: false,
        gateScanVerified: false,
        cartonBarcodeVerified: false,
        latestAt: new Date().toISOString(),
      },
      evidence: [],
    });
    expect(fusion.input.openExceptionTypes).toContain("dispatch_barcode_mismatch");
  });

  it("rejected gate scan blocks readiness", () => {
    const fusion = deriveReadinessInputFromSlices({
      orderId: "o1",
      reservationStatus: "reserved",
      financeSignal: "ready",
      financeMeta: { signalGeneratedAt: new Date().toISOString(), signalAgeMs: 0, stale: false },
      scan: {
        hasUnresolvedMismatch: false,
        hasRejectedGateScan: true,
        gateScanVerified: false,
        cartonBarcodeVerified: false,
        latestAt: new Date().toISOString(),
      },
      evidence: [],
    });
    expect(fusion.input.openExceptionTypes).toContain("dispatch_gate_rejected");
  });
});

describe("completion adapter", () => {
  it("completion_attested does not equal dispatched", () => {
    expect(completionAttestedIsNotDispatched("completion_attested", "cleared_for_dispatch")).toBe(true);
    expect(completionAttestedIsNotDispatched("completion_attested", "dispatched")).toBe(false);
  });
});

describe("stock adapter", () => {
  it("requires dispatch_finalized and dispatched", () => {
    expect(isStockFinalizationCandidate("dispatched", "dispatch_finalized")).toBe(true);
    expect(isStockFinalizationCandidate("cleared_for_dispatch", "dispatch_finalized")).toBe(false);
  });

  it("variance blocks stock finalization candidate", () => {
    const fusion = deriveStockInputFromSlices({
      orderId: "o1",
      orderStatus: "dispatched",
      dispatchReleaseStatus: "dispatch_finalized",
      reservations: [
        {
          id: "r1",
          reservationNumber: "RSV-1",
          orderId: "o1",
          productId: "p1",
          sku: "SKU",
          requestedQty: 10,
          reservedQty: 5,
          fulfilledQty: 0,
          releasedQty: 0,
          reservationStatus: "reserved",
        },
      ],
      scanReference: "scan-1",
      gateReference: "gate-1",
      dispatchLineageId: null,
      locationCode: "WH",
      balances: [],
      lineage: [],
    });
    const recon = reconcileReservationsForConsumption(fusion.input.reservations, []);
    expect(recon.reconciliationStatus).toBe("variance");
    expect(fusion.reconciliationVariance).toBe(true);
  });

  it("missing balance surfaces balance_not_found", () => {
    const fusion = deriveStockInputFromSlices({
      orderId: "o1",
      orderStatus: "dispatched",
      dispatchReleaseStatus: "dispatch_finalized",
      reservations: [
        {
          id: "r1",
          reservationNumber: "RSV-1",
          orderId: "o1",
          productId: "p1",
          sku: "SKU",
          requestedQty: 5,
          reservedQty: 5,
          fulfilledQty: 0,
          releasedQty: 0,
          reservationStatus: "reserved",
        },
      ],
      scanReference: "scan",
      gateReference: "gate",
      dispatchLineageId: null,
      locationCode: "WH",
      balances: [],
      lineage: [],
    });
    expect(fusion.balanceMissing).toBe(true);
    expect(fusion.missingSignals.some((s) => s.startsWith("balance_not_found"))).toBe(true);
  });
});

describe("preview fallback", () => {
  it("preview is off by default in vitest", () => {
    expect(isPreviewFallbackEnabled()).toBe(false);
  });

  it("empty live rows without preview flag resolve to empty not preview", () => {
    expect(resolveBoardProjectionSource(0, true)).toBe("empty");
    expect(isPreviewFallbackEnabled()).toBe(false);
  });
});

describe("blocked finance blocks readiness and finalization", () => {
  it("blocked finance adds readiness exception", () => {
    const fusion = deriveReadinessInputFromSlices({
      orderId: "o1",
      reservationStatus: "reserved",
      financeSignal: "blocked",
      financeMeta: { signalGeneratedAt: new Date().toISOString(), signalAgeMs: 0, stale: false },
      scan: {
        hasUnresolvedMismatch: false,
        hasRejectedGateScan: false,
        gateScanVerified: true,
        cartonBarcodeVerified: true,
        latestAt: new Date().toISOString(),
      },
      evidence: [],
    });
    expect(fusion.input.openExceptionTypes).toContain("dispatch_finance_signal_blocked");
    const projection = projectDispatchReadiness(fusion.input);
    expect(projection.readinessStatus).not.toBe("gate_eligible");
  });

  it("blocked finance prevents finalization candidate", () => {
    const fusion = deriveFinalizationInputFromSlices({
      orderId: "o1",
      currentOrderStatus: "cleared_for_dispatch",
      readinessStatus: "gate_eligible",
      financeSignal: "blocked",
      financeReleaseStatus: "finance_hold",
      completionStatus: "completion_attested",
      reservationReady: true,
      transporterReference: "AWB-1",
      gateReference: "gate-1",
      completionReference: "attest-1",
      lineage: [],
      financeBlocked: true,
      scanBlocked: false,
    });
    expect(fusion.input.openReleaseBlockers.length).toBeGreaterThan(0);
  });
});

describe("empty and unavailable read state", () => {
  it("unavailable result has no rows and safe metadata", () => {
    const result = emptyReadModelResult("unavailable", ["orders"], ["table_missing"]);
    expect(result.rows).toHaveLength(0);
    expect(result.meta.projectionSource).toBe("unavailable");
    expect(result.meta.missingSignals).toContain("table_missing");
  });
});
