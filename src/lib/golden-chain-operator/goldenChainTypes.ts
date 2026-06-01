import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { StockFinalizationInput } from "@/lib/stock-finalization/stockFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import type { FinalizationLineageSlice } from "@/lib/execution-read-models/adapters/finalizationSignalAdapter";

export const GOLDEN_CHAIN_STAGES = [
  "4b_readiness",
  "4c_finance",
  "4d_completion",
  "4e_dispatch_finalization",
  "4f_reservation",
  "4g_stock",
  "complete",
] as const;

export type GoldenChainStage = (typeof GOLDEN_CHAIN_STAGES)[number];

export const GOLDEN_CHAIN_CTA_LABELS = [
  "Complete readiness",
  "Complete finance release",
  "Complete completion attestation",
  "Finalize dispatch",
  "Create reservation",
  "Finalize stock consumption",
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
  stage: GoldenChainStage;
  cta: GoldenChainCtaLabel;
  blockers: GoldenChainBlocker[];
  evidenceRefs: GoldenChainEvidenceRefs;
  dispatchAlreadyFinalized: boolean;
  stockConsumptionComplete: boolean;
}
