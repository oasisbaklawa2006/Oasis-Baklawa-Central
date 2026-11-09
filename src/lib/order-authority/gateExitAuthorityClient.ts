import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type RpcError = { message: string; code?: string };

export class GateExitAuthorityError extends Error {
  readonly code?: string;
  constructor(error: RpcError | string) {
    super(typeof error === "string" ? error : error.message);
    this.name = "GateExitAuthorityError";
    if (typeof error !== "string") this.code = error.code;
  }
}

export type B2bGateReleaseResult = {
  ok: boolean;
  cartonId?: string;
  orderId?: string;
  alreadyReleased: boolean;
  blockers: Array<{ code: string; message?: string }>;
};

function objectResult(data: Json | null): Record<string, Json | undefined> {
  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw new GateExitAuthorityError("Core returned no B2B gate decision");
  }
  return data as Record<string, Json | undefined>;
}

export type B2bGateScanResult = {
  scanId: string;
  cartonId: string;
  orderId?: string;
  alreadyRecorded: boolean;
};

/** Core owns Gate scan provenance. Never write authoritative scan rows directly from the browser. */
export async function recordB2bDispatchGateScan(
  cartonId: string,
  barcode: string,
  idempotencyKey: string,
): Promise<B2bGateScanResult> {
  const { data, error } = await supabase.rpc("record_b2b_dispatch_gate_scan_v1", {
    p_carton_id: cartonId,
    p_scanned_barcode: barcode,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new GateExitAuthorityError(error);
  const value = objectResult(data);
  if (value.ok !== true || typeof value.scan_id !== "string" || !value.scan_id.trim()
      || value.carton_id !== cartonId) {
    throw new GateExitAuthorityError("Core returned invalid B2B Gate scan evidence");
  }
  return {
    scanId: value.scan_id,
    cartonId,
    orderId: typeof value.order_id === "string" ? value.order_id : undefined,
    alreadyRecorded: value.already_recorded === true,
  };
}

export async function releaseB2bCartonAtDispatchGate(cartonId: string, scanEvidenceId: string): Promise<B2bGateReleaseResult> {
  const { data, error } = await supabase.rpc("release_b2b_dispatch_carton_at_gate_v1", {
    p_carton_id: cartonId,
    p_scan_evidence_id: scanEvidenceId,
  });
  if (error) throw new GateExitAuthorityError(error);
  const value = objectResult(data);
  const blockersValue = value.blockers;
  const blockers = Array.isArray(blockersValue)
    ? blockersValue
        .filter((item): item is Record<string, Json | undefined> => !!item && !Array.isArray(item) && typeof item === "object")
        .map((item) => ({
          code: typeof item.code === "string" ? item.code : "unknown_blocker",
          message: typeof item.message === "string" ? item.message : undefined,
        }))
    : [];
  return {
    ok: value.ok === true,
    cartonId: typeof value.carton_id === "string" ? value.carton_id : undefined,
    orderId: typeof value.order_id === "string" ? value.order_id : undefined,
    alreadyReleased: value.already_released === true,
    blockers,
  };
}
