import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchWhatsAppCaseDecisionSnapshot,
  type WhatsAppCaseDecisionSnapshot,
} from "@/lib/wa-governance/caseDecisionDesk";
import {
  enrichClarificationHealthFromSnapshot,
  fetchPacketAutonomyViews,
  type PacketAutonomyView,
} from "@/lib/wa-governance/orderAutonomy";

export type OperatorDecisionDeskLoadResult = {
  snapshot: WhatsAppCaseDecisionSnapshot;
  autonomy: PacketAutonomyView;
};

export async function loadOperatorDecisionDeskState(
  supabase: SupabaseClient,
  targetPacketId: string,
): Promise<OperatorDecisionDeskLoadResult> {
  const [snapshot, autonomyMap] = await Promise.all([
    fetchWhatsAppCaseDecisionSnapshot(supabase, targetPacketId),
    fetchPacketAutonomyViews(supabase, [targetPacketId], { includeGovernedDetail: true }),
  ]);
  const autonomy = autonomyMap.get(targetPacketId) ?? {
    packetId: targetPacketId,
    readState: "FAILED",
    executionReadState: "FAILED",
    decision: null,
    readError: "AUTONOMY_VIEW_MISSING",
    executionReadError: null,
    clarificationHealth: "UNKNOWN",
  };
  autonomy.clarificationHealth = enrichClarificationHealthFromSnapshot(snapshot, autonomy.decision);
  return { snapshot, autonomy };
}
