import { dispatchDb as governedReadDb } from "@/lib/dispatchGovernedRpc";
import {
  EMPTY_THREE_PGS_SNAPSHOT,
  THREE_PGS_STORE_CODE,
  type AssemblyRequirement,
  type Balance,
  type Grn,
  type PriorityDemand,
  type Procurement,
  type Receipt,
  type Snapshot,
} from "@/pages/admin/threePgsCommandCentreModel";

export async function loadThreePgsCommandCentreSnapshot(): Promise<Snapshot> {
  const [balances, demand, procurement, assembly, receipts] = await Promise.all([
    governedReadDb.from<Balance>("inventory_stock_balances")
      .select("id, sku, location_code, available_qty, reserved_qty, picked_qty, damaged_qty, expired_qty, quarantine_qty")
      .eq("location_code", THREE_PGS_STORE_CODE)
      .order("sku", { ascending: true })
      .limit(1000),
    governedReadDb.from<PriorityDemand>("b2b_3pgs_pending_demand_priority")
      .select("demand_id, demand_reference, demand_source_type, priority_rank, sku, location_code, outstanding_qty")
      .order("priority_rank", { ascending: true })
      .limit(100),
    governedReadDb.from<Procurement>("b2b_procurement_requirements")
      .select("id, requirement_number, sku, destination_store_code, shortage_qty, fulfilled_qty, vendor_reference, expected_at, status")
      .eq("destination_store_code", THREE_PGS_STORE_CODE)
      .order("created_at", { ascending: false })
      .limit(100),
    governedReadDb.from<AssemblyRequirement>("b2b_assembly_3pgs_requirements")
      .select("id, requirement_number, sku, source_store_code, requested_qty, fulfilled_qty, status, priority")
      .in("status", ["open", "partially_fulfilled"])
      .order("created_at", { ascending: true })
      .limit(100),
    governedReadDb.from<Receipt>("b2b_inventory_receipts")
      .select("id, receipt_number, destination_store_code, status, created_at")
      .eq("destination_store_code", THREE_PGS_STORE_CODE)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const sourceError = [balances, demand, procurement, assembly, receipts]
    .find((result) => result.error !== null)?.error;
  if (sourceError) throw new Error(sourceError.message);

  const receiptRows = receipts.data ?? [];
  const receiptIds = receiptRows.map((receipt) => receipt.id);
  const grns = receiptIds.length > 0
    ? await governedReadDb.from<Grn>("b2b_inventory_grns")
      .select("id, grn_number, receipt_id, status, finalised_at")
      .in("receipt_id", receiptIds)
      .order("created_at", { ascending: false })
    : { data: [] as Grn[], error: null };

  if (grns.error) throw new Error(grns.error.message);

  return {
    balances: balances.data ?? [],
    demand: demand.data ?? [],
    procurement: procurement.data ?? [],
    assembly: assembly.data ?? [],
    receipts: receiptRows,
    grns: grns.data ?? [],
  };
}

export async function loadThreePgsCommandCentreSnapshotSafe(): Promise<{ snapshot: Snapshot; error: string | null }> {
  try {
    return { snapshot: await loadThreePgsCommandCentreSnapshot(), error: null };
  } catch (err) {
    return {
      snapshot: EMPTY_THREE_PGS_SNAPSHOT,
      error: err instanceof Error ? err.message : "Failed to load governed 3PGS truth.",
    };
  }
}
