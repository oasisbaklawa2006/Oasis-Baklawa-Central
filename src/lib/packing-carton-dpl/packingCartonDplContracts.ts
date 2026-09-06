import type {
  GovernedCartonItemRow,
  GovernedCartonRow,
  GovernedConsignmentLineRow,
  GovernedDplVersionRow,
  PackingContractResult,
  PackingContractViolation,
} from "./packingCartonDplTypes";

/** Carton statuses that satisfy the lock precondition for DPL generation (FACT-C1). */
export const LOCKED_CARTON_STATUSES = new Set([
  "locked",
  "finance_check_open",
  "verified",
  "labelled",
  "ready_to_load",
  "loaded",
  "handed_over",
]);

function violation(code: string, message: string): PackingContractViolation {
  return { code, message };
}

function result(violations: PackingContractViolation[]): PackingContractResult {
  return { ok: violations.length === 0, violations };
}

/** Returns carton codes that appear more than once within a consignment. */
export function findDuplicateCartonCodes(cartons: Pick<GovernedCartonRow, "id" | "carton_code">[]): string[] {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const carton of cartons) {
    const code = carton.carton_code.trim().toLowerCase();
    if (!code) continue;
    const prior = seen.get(code);
    if (prior && prior !== carton.id) duplicates.add(carton.carton_code);
    else seen.set(code, carton.id);
  }
  return [...duplicates];
}

/** Asserts carton codes are unique within the consignment scope. */
export function assertCartonUniqueness(cartons: Pick<GovernedCartonRow, "id" | "carton_code">[]): PackingContractResult {
  const duplicates = findDuplicateCartonCodes(cartons);
  if (duplicates.length === 0) return result([]);
  return result(duplicates.map((code) => violation("CARTON_DUPLICATE", `Duplicate carton code: ${code}`)));
}

export type LineQuantityReconciliation = {
  lineId: string;
  productCode: string;
  acceptedReadyQty: number;
  authoritativePackedQty: number;
  scannedInCartonsTotal: number;
  conserved: boolean;
};

/**
 * Reconciles consignment-line packed_qty authority against summed carton-item scans.
 * Quantity conservation holds when scanned totals do not exceed authoritative packed_qty
 * and every line with packed_qty > 0 has matching carton items.
 */
export function reconcileLineQuantities(
  lines: GovernedConsignmentLineRow[],
  cartonItems: GovernedCartonItemRow[],
): LineQuantityReconciliation[] {
  const scannedByLine = new Map<string, number>();
  for (const item of cartonItems) {
    scannedByLine.set(item.consignment_line_id, (scannedByLine.get(item.consignment_line_id) ?? 0) + item.quantity);
  }
  return lines.map((line) => {
    const scannedInCartonsTotal = scannedByLine.get(line.id) ?? 0;
    const conserved =
      scannedInCartonsTotal <= line.packed_qty &&
      (line.packed_qty === 0 || scannedInCartonsTotal > 0 || line.accepted_ready_qty === 0);
    return {
      lineId: line.id,
      productCode: line.product_code,
      acceptedReadyQty: line.accepted_ready_qty,
      authoritativePackedQty: line.packed_qty,
      scannedInCartonsTotal,
      conserved,
    };
  });
}

/** Fails when any line's carton scans exceed authoritative packed_qty. */
export function assertQuantityConservation(
  lines: GovernedConsignmentLineRow[],
  cartonItems: GovernedCartonItemRow[],
): PackingContractResult {
  const reconciliations = reconcileLineQuantities(lines, cartonItems);
  const violations: PackingContractViolation[] = [];
  for (const row of reconciliations) {
    if (row.scannedInCartonsTotal > row.authoritativePackedQty) {
      violations.push(
        violation(
          "QUANTITY_OVER_PACK",
          `${row.productCode}: scanned ${row.scannedInCartonsTotal} exceeds authoritative packed ${row.authoritativePackedQty}`,
        ),
      );
    }
    if (row.authoritativePackedQty > 0 && row.scannedInCartonsTotal === 0) {
      violations.push(
        violation(
          "QUANTITY_UNDER_PACK",
          `${row.productCode}: authoritative packed ${row.authoritativePackedQty} but no carton items recorded`,
        ),
      );
    }
  }
  return result(violations);
}

export type PartialPackingState = {
  isPartial: boolean;
  unresolvedLineIds: string[];
  fullyPacked: boolean;
  canGenerateDpl: boolean;
};

/**
 * Partial/split consignment packing: a consignment may ship a subset of accepted-ready qty.
 * DPL generation is allowed only when every carton is locked and at least one line is packed.
 */
export function derivePartialPackingState(
  lines: GovernedConsignmentLineRow[],
  cartons: GovernedCartonRow[],
): PartialPackingState {
  const unresolvedLineIds = lines
    .filter((line) => line.packed_qty > 0 && line.packed_qty < line.accepted_ready_qty)
    .map((line) => line.id);
  const fullyPacked = lines.length > 0 && lines.every((line) => line.packed_qty >= line.accepted_ready_qty);
  const isPartial = unresolvedLineIds.length > 0;
  const allCartonsLocked = cartons.length > 0 && cartons.every((c) => LOCKED_CARTON_STATUSES.has(c.status));
  const hasPackedQty = lines.some((line) => line.packed_qty > 0);
  return {
    isPartial,
    unresolvedLineIds,
    fullyPacked,
    canGenerateDpl: allCartonsLocked && hasPackedQty,
  };
}

/** Returns the current (non-superseded) DPL version, if any. */
export function deriveCurrentDplVersion(versions: GovernedDplVersionRow[]): GovernedDplVersionRow | null {
  return versions.find((v) => v.status !== "superseded") ?? null;
}

/** Immutable versioning: superseded versions must point forward; current must not be superseded. */
export function assertDplVersionChain(versions: GovernedDplVersionRow[]): PackingContractResult {
  const violations: PackingContractViolation[] = [];
  const byId = new Map(versions.map((v) => [v.id, v]));
  for (const version of versions) {
    if (version.superseded_by && !byId.has(version.superseded_by)) {
      violations.push(
        violation("DPL_STALE_POINTER", `Version ${version.version_number} points to missing successor`),
      );
    }
    if (version.status === "superseded" && !version.superseded_by) {
      violations.push(
        violation("DPL_SUPERSEDE_INCOMPLETE", `Version ${version.version_number} is superseded without successor id`),
      );
    }
  }
  const currents = versions.filter((v) => v.status !== "superseded");
  if (currents.length > 1) {
    violations.push(violation("DPL_MULTIPLE_CURRENT", `Multiple current DPL versions: ${currents.map((v) => v.version_number).join(", ")}`));
  }
  return result(violations);
}

/** Stale lock rejection — client must pass p_expected_version matching carton.current_version. */
export function assertLockVersionFresh(
  carton: Pick<GovernedCartonRow, "id" | "current_version">,
  submittedVersion: number,
): PackingContractResult {
  if (submittedVersion !== carton.current_version) {
    return result([
      violation(
        "STALE_CARTON_VERSION",
        `Carton ${carton.id}: expected version ${carton.current_version}, received ${submittedVersion}`,
      ),
    ]);
  }
  return result([]);
}

/** Evidence must be source-bound before lock (weight and/or photo ref from governed RPC). */
export function assertCartonEvidenceBound(
  carton: Pick<GovernedCartonRow, "id" | "net_weight" | "gross_weight" | "open_photo_ref">,
): PackingContractResult {
  const hasWeight =
    (carton.net_weight !== null && carton.net_weight > 0) ||
    (carton.gross_weight !== null && carton.gross_weight > 0);
  const hasPhoto = Boolean(carton.open_photo_ref?.trim());
  if (!hasWeight && !hasPhoto) {
    return result([
      violation("EVIDENCE_UNBOUND", `Carton ${carton.id}: net/gross weight or open photo evidence required before lock`),
    ]);
  }
  return result([]);
}

/** Finance handoff eligibility — DPL must be generated and not yet submitted. */
export function deriveFinanceHandoffEligibility(
  dpl: GovernedDplVersionRow | null,
  cartons: GovernedCartonRow[],
): { eligible: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!dpl) blockers.push("No current DPL version");
  else if (dpl.status === "superseded") blockers.push("DPL version is superseded");
  else if (dpl.submitted_to_finance_at) blockers.push("DPL already submitted to Finance");
  else if (dpl.status !== "generated") blockers.push(`DPL status must be generated (current: ${dpl.status})`);

  const unlocked = cartons.filter((c) => !LOCKED_CARTON_STATUSES.has(c.status));
  if (unlocked.length > 0) {
    blockers.push(`${unlocked.length} carton(s) still unlocked`);
  }
  return { eligible: blockers.length === 0, blockers };
}

/** Aggregates all packing contract checks for a consignment read model. */
export function evaluatePackingContracts(input: {
  cartons: GovernedCartonRow[];
  cartonItems: GovernedCartonItemRow[];
  lines: GovernedConsignmentLineRow[];
  dplVersions: GovernedDplVersionRow[];
}): {
  uniqueness: PackingContractResult;
  quantity: PackingContractResult;
  dplChain: PackingContractResult;
  partial: PartialPackingState;
  financeHandoff: ReturnType<typeof deriveFinanceHandoffEligibility>;
  allOk: boolean;
} {
  const uniqueness = assertCartonUniqueness(input.cartons);
  const quantity = assertQuantityConservation(input.lines, input.cartonItems);
  const dplChain = assertDplVersionChain(input.dplVersions);
  const partial = derivePartialPackingState(input.lines, input.cartons);
  const financeHandoff = deriveFinanceHandoffEligibility(deriveCurrentDplVersion(input.dplVersions), input.cartons);
  const allOk = uniqueness.ok && quantity.ok && dplChain.ok;
  return { uniqueness, quantity, dplChain, partial, financeHandoff, allOk };
}
