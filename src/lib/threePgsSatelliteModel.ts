import type { AssemblyRequirement, PriorityDemand, Snapshot } from "@/pages/admin/threePgsCommandCentreModel";
import { threePgsCommandCentreMetrics } from "@/pages/admin/threePgsCommandCentreModel";

export type ThreePgsSatelliteAudience = "pna" | "outlet" | "b2b" | "dispatch" | "management";

export type ThreePgsSatelliteProjection = {
  audience: ThreePgsSatelliteAudience;
  label: string;
  description: string;
  demand: PriorityDemand[];
  assembly: AssemblyRequirement[];
  metrics: ReturnType<typeof threePgsCommandCentreMetrics>;
};

const AUDIENCE_LABELS: Record<ThreePgsSatelliteAudience, { label: string; description: string }> = {
  pna: {
    label: "P&A satellite",
    description: "Read-only visibility into P&A-linked 3PGS demand and open assembly requirements.",
  },
  outlet: {
    label: "Outlet satellite",
    description: "Read-only visibility into outlet-booked 3PGS demand.",
  },
  b2b: {
    label: "Sales satellite",
    description: "Read-only visibility into B2B advance-order 3PGS demand.",
  },
  dispatch: {
    label: "Dispatch satellite",
    description: "Read-only visibility into packaging readiness and priority demand affecting dispatch.",
  },
  management: {
    label: "Management satellite",
    description: "Read-only management summary over governed 3PGS stock, demand and inbound progress.",
  },
};

function demandForAudience(snapshot: Snapshot, audience: ThreePgsSatelliteAudience): PriorityDemand[] {
  switch (audience) {
    case "pna":
      return snapshot.demand.filter((row) => row.demand_source_type === "pna");
    case "outlet":
      return snapshot.demand.filter((row) => row.demand_source_type === "outlet");
    case "b2b":
      return snapshot.demand.filter((row) => row.demand_source_type === "b2b");
    case "dispatch":
    case "management":
      return snapshot.demand;
  }
}

function assemblyForAudience(snapshot: Snapshot, audience: ThreePgsSatelliteAudience): AssemblyRequirement[] {
  if (audience === "pna" || audience === "dispatch" || audience === "management") {
    return snapshot.assembly;
  }
  return [];
}

export function projectThreePgsSatellite(snapshot: Snapshot, audience: ThreePgsSatelliteAudience): ThreePgsSatelliteProjection {
  const demand = demandForAudience(snapshot, audience);
  const assembly = assemblyForAudience(snapshot, audience);
  const meta = AUDIENCE_LABELS[audience];

  return {
    audience,
    label: meta.label,
    description: meta.description,
    demand,
    assembly,
    metrics: threePgsCommandCentreMetrics({
      ...snapshot,
      demand,
      assembly,
    }),
  };
}

export type ThreePgsMobileUrgentItem = {
  id: string;
  kind: "demand" | "assembly" | "receipt";
  title: string;
  subtitle: string;
  quantityLabel: string;
  priorityRank?: number;
};

export function buildThreePgsMobileUrgentItems(snapshot: Snapshot, limit = 12): ThreePgsMobileUrgentItem[] {
  const items: ThreePgsMobileUrgentItem[] = [];

  for (const row of snapshot.demand.slice(0, limit)) {
    items.push({
      id: `demand:${row.demand_id}`,
      kind: "demand",
      title: row.sku,
      subtitle: `${row.demand_source_type.toUpperCase()} · ${row.demand_reference}`,
      quantityLabel: `${row.outstanding_qty} outstanding`,
      priorityRank: row.priority_rank,
    });
  }

  for (const row of snapshot.assembly.slice(0, Math.max(0, limit - items.length))) {
    items.push({
      id: `assembly:${row.id}`,
      kind: "assembly",
      title: row.sku,
      subtitle: `${row.requirement_number} · ${row.status.replace(/_/g, " ")}`,
      quantityLabel: `${row.fulfilled_qty} / ${row.requested_qty}`,
    });
  }

  const awaitingGrn = snapshot.receipts.filter(
    (receipt) =>
      receipt.status !== "cancelled" &&
      receipt.status !== "rejected" &&
      !snapshot.grns.some((grn) => grn.receipt_id === receipt.id && (grn.status === "finalised" || grn.finalised_at !== null)),
  );

  for (const receipt of awaitingGrn.slice(0, Math.max(0, limit - items.length))) {
    items.push({
      id: `receipt:${receipt.id}`,
      kind: "receipt",
      title: receipt.receipt_number,
      subtitle: `Receipt ${receipt.status.replace(/_/g, " ")}`,
      quantityLabel: "Awaiting GRN",
    });
  }

  return items.slice(0, limit);
}

export type ThreePgsTvLane = {
  key: string;
  label: string;
  value: number;
};

export function buildThreePgsTvLanes(snapshot: Snapshot): ThreePgsTvLane[] {
  const metrics = threePgsCommandCentreMetrics(snapshot);
  return [
    { key: "available", label: "Available", value: metrics.available },
    { key: "reserved", label: "Reserved", value: metrics.reserved },
    { key: "open-assembly", label: "Open P&A", value: metrics.openAssembly },
    { key: "open-procurement", label: "Open procurement", value: metrics.openProcurement },
    { key: "awaiting-grn", label: "Awaiting GRN", value: metrics.receiptsAwaitingGrn },
    { key: "exceptions", label: "Exception qty", value: metrics.exceptions },
  ];
}
