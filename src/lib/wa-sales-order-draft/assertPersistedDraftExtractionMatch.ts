import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import type { SalesOrderDraftStatus } from "./types";
import { assertActiveDraftExtractionVersion } from "./draftIntegrityContract";

export function assertPersistedDraftExtractionMatch(args: {
  extracted: ExtractedDraftOrder;
  extractionRequestKey: string;
  status: SalesOrderDraftStatus;
  actionLabel: string;
}): void {
  if (args.status === "APPROVED_FOR_SO" || args.status === "REJECTED") {
    throw new Error(`Cannot ${args.actionLabel} from terminal status ${args.status}.`);
  }

  assertActiveDraftExtractionVersion({
    persistedExtractionRequestKey: args.extractionRequestKey,
    liveExtractionRequestKey: args.extracted.extractionRequestKey,
    actionLabel: args.actionLabel,
  });
}
