import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import type { SalesOrderDraftStatus } from "./types";

export function assertPersistedDraftExtractionMatch(args: {
  extracted: ExtractedDraftOrder;
  extractionRequestKey: string;
  status: SalesOrderDraftStatus;
  actionLabel: string;
}): void {
  if (args.status === "APPROVED_FOR_SO" || args.status === "REJECTED") {
    throw new Error(`Cannot ${args.actionLabel} from terminal status ${args.status}.`);
  }

  if (args.extracted.extractionRequestKey !== args.extractionRequestKey) {
    throw new Error(
      "Live extraction no longer matches the persisted draft projection. Reload the packet before syncing operator edits.",
    );
  }
}
