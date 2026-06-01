import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { StockFinalizationInput } from "@/lib/stock-finalization/stockFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import type { FinalizationLineageSlice } from "@/lib/execution-read-models/adapters/finalizationSignalAdapter";
import type {
  ReadinessEvidenceSlice,
  ReadinessScanSlice,
} from "@/lib/execution-read-models/adapters/readinessSignalAdapter";

export const GOLDEN_CHAIN_STAGES = [
  "prepare_dispatch_evidence",
  "finance_release",
  "readiness_review",
  "completion_attestation",
  "dispatch_finalization",
  "reservation",
  "stock_finalization",
  "complete",
] as const;

export type GoldenChainStage = (typeof GOLDEN_CHAIN_STAGES)[number];

export const GOLDEN_CHAIN_CTA_LABELS = [
  "Prepare dispatch evidence",
  "Complete finance release",
  "Complete readiness review",
  "Attest completion",
  "Finalize dispatch",
  "Reserve stock",
  "Finalize stock",
  "Already complete",
] as const;

export type GoldenChainCtaLabel = (typeof GOLDEN_CHAIN_CTA_LABELS)[number];

export interface GoldenChainBlocker {
  message: string;
  route: string;
  action: string;
  technicalDetail?: string;
}

export interface GoldenChainEvidenceRefs {
  packingPhotoRef: string;
  documentPlaceholderRef: string;
  gateScanRef: string;
  transporterRef: string;
  stockFinalizeReason: string;
  overrideReason: string;
}

export interface GoldenChainOrderLine {
  productId: string;
  sku: string;
  productName: string | null;
  quantity: number;
}

export interface GoldenChainOrderSummary {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  paymentStatus: string | null;
  governanceStageLabel: string;
  nextAction: GoldenChainCtaLabel;
}

export interface GoldenChainOrderState {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  paymentStatus: string | null;
  companyName: string | null;
  orderLines: GoldenChainOrderLine[];
  staffStageLabel: string;
  requiredRole: "dispatch" | "finance" | "inventory" | "supervisor" | "none";
  whoMustActNext: string;
  readinessInput: DispatchReadinessInput;
  financeInput: FinanceGovernanceInput;
  completionInput: DispatchCompletionInput;
  finalizationInput: DispatchFinalizationInput;
  stockInput: StockFinalizationInput | null;
  reservations: StockReservationRecord[];
  dispatchLineage: FinalizationLineageSlice[];
  consumptionFinalizedReservationIds: string[];
  readinessEvidenceSlices: ReadinessEvidenceSlice[];
  scanSlice: ReadinessScanSlice;
  dispatchEvidencePrepared: boolean;
  stage: GoldenChainStage;
  cta: GoldenChainCtaLabel;
  blockers: GoldenChainBlocker[];
  evidenceRefs: GoldenChainEvidenceRefs;
  dispatchAlreadyFinalized: boolean;
  stockConsumptionComplete: boolean;
}
