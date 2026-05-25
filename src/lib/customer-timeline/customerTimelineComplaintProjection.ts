import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type { ComplaintState } from "./customerTimelineTypes";
import { mapOperationalEventToCustomerStatus } from "./customerTimelineEventMapper";

export function deriveComplaintState(events: OperationalStoreEventRecord[]): ComplaintState {
  let state: ComplaintState = "none";
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const ev of sorted) {
    const mapped = mapOperationalEventToCustomerStatus(ev);
    if (mapped.suppressed) continue;
    if (mapped.status === "complaint_under_review") state = "under_review";
    if (mapped.status === "resolved") state = "resolved";
  }
  return state;
}
