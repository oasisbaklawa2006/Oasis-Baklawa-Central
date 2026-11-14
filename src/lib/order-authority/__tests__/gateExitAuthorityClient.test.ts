import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { recordB2bDispatchGateScan, releaseB2bCartonAtDispatchGate } from "@/lib/order-authority/gateExitAuthorityClient";
import { escapeGateBarcodeIlikeLiteral, gateScanCorrelationId, matchUniqueCaseInsensitiveGateCarton } from "@/utils/gateScanEvidence";

beforeEach(() => rpc.mockReset());

describe("Core #507 governed B2B Gate scan contract", () => {
  it("uses the server-authoritative scan writer and preserves its evidence ID", async () => {
    rpc.mockResolvedValueOnce({
      data: { ok: true, scan_id: "scan-1", carton_id: "carton-1", order_id: "order-1", already_recorded: false },
      error: null,
    });
    const key = gateScanCorrelationId("carton-1", "ctn-001");
    const scan = await recordB2bDispatchGateScan("carton-1", "CTN-001", key);
    expect(rpc).toHaveBeenCalledWith("record_b2b_dispatch_gate_scan_v1", {
      p_carton_id: "carton-1",
      p_scanned_barcode: "CTN-001",
      p_idempotency_key: key,
    });
    expect(scan).toEqual({ scanId: "scan-1", cartonId: "carton-1", orderId: "order-1", alreadyRecorded: false });
    expect(gateScanCorrelationId("carton-1", "ctn-001")).toBe(key);
  });

  it("accepts a same-key retry without inventing a fresh scan", async () => {
    rpc.mockResolvedValueOnce({
      data: { ok: true, scan_id: "existing-scan", carton_id: "carton-1", already_recorded: true },
      error: null,
    });
    expect(await recordB2bDispatchGateScan("carton-1", "CTN-001", "gate:carton-1:ctn-001")).toEqual({
      scanId: "existing-scan", cartonId: "carton-1", orderId: undefined, alreadyRecorded: true,
    });
  });

  it("fails closed for a missing RPC, revoked staff, or any server error", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "function not found", code: "PGRST202" } });
    await expect(recordB2bDispatchGateScan("carton-1", "CTN-001", "key-1")).rejects.toThrow("function not found");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "B2B_GATE_SCAN_ACTOR_INACTIVE", code: "42501" } });
    await expect(recordB2bDispatchGateScan("carton-1", "CTN-001", "key-1")).rejects.toThrow("B2B_GATE_SCAN_ACTOR_INACTIVE");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed, false-positive, or mismatched scan evidence", async () => {
    for (const data of [
      null,
      { ok: false, scan_id: "fake", carton_id: "carton-1" },
      { ok: true, carton_id: "carton-1" },
      { ok: true, scan_id: "other-scan", carton_id: "carton-2" },
    ]) {
      rpc.mockResolvedValueOnce({ data, error: null });
      await expect(recordB2bDispatchGateScan("carton-1", "CTN-001", "key-1")).rejects.toThrow();
    }
  });

  it("passes the authentic scan ID into the unchanged Core release RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: { ok: true, carton_id: "carton-1", already_released: false },
      error: null,
    });
    const result = await releaseB2bCartonAtDispatchGate("carton-1", "scan-1");
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("release_b2b_dispatch_carton_at_gate_v1", {
      p_carton_id: "carton-1", p_scan_evidence_id: "scan-1",
    });
  });
});


describe("Case-insensitive literal Gate barcode lookup", () => {
  it("escapes LIKE wildcards and backslashes without changing normal carton identifiers", () => {
    expect(escapeGateBarcodeIlikeLiteral("CTN-001")).toBe("CTN-001");
    expect(escapeGateBarcodeIlikeLiteral("CTN_1%Z")).toBe("CTN\\_1\\%Z");
    expect(escapeGateBarcodeIlikeLiteral("CTN*1")).toBe("CTN\\*1");
    expect(escapeGateBarcodeIlikeLiteral("CTN\\1")).toBe("CTN\\\\1");
  });
  it("accepts exactly one case-insensitive match and rejects wrong or ambiguous cartons", () => {
    const a = { id: "a", carton_code: "CTN-001" };
    const b = { id: "b", carton_code: "ctn-001" };
    expect(matchUniqueCaseInsensitiveGateCarton([a], "ctn-001")).toBe(a);
    expect(matchUniqueCaseInsensitiveGateCarton([a], "other")).toBeNull();
    expect(matchUniqueCaseInsensitiveGateCarton([], "CTN-001")).toBeNull();
    expect(matchUniqueCaseInsensitiveGateCarton(null, "CTN-001")).toBeNull();
    expect(matchUniqueCaseInsensitiveGateCarton([a, b], "CTN-001")).toBeNull();
  });
});
