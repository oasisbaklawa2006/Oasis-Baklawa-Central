export type Wa1PotentialOrder = {
  id: string;
  state: "NEW" | "UNASSIGNED" | "FAILED_INTERPRETATION" | "AWAITING_CLARIFICATION" | "AGEING" | "AT_RISK" | "ESCALATED" | "CONVERTED" | "EXPLICITLY_CLOSED";
  disposition: "ACTIVE_PENDING" | "CONVERTED" | "EXPLICITLY_CLOSED";
  queue: string;
  next_action: string;
  next_action_due_at: string;
  owner_id: string | null;
};

export function summarizeWa1Queue(rows: Wa1PotentialOrder[]) {
  const active = rows.filter((row) => row.disposition === "ACTIVE_PENDING");
  return {
    active: active.length,
    unassigned: active.filter((row) => row.state === "UNASSIGNED" || !row.owner_id).length,
    failed: active.filter((row) => row.state === "FAILED_INTERPRETATION").length,
    atRisk: active.filter((row) => ["AT_RISK", "ESCALATED"].includes(row.state)).length,
  };
}
