export {
  FORBIDDEN_STOCK_UI_PATTERNS,
  STOCK_FINALIZATION_STATUSES,
  StockFinalizationError,
} from "./stockFinalizationTypes";
export type {
  StockFinalizationInput,
  StockFinalizationProjection,
  StockFinalizationWriteContext,
} from "./stockFinalizationTypes";
export { projectStockFinalization } from "./stockFinalizationProjection";
export { evaluateStockDeductionEligibility, isDispatchFinalizedForStock } from "./stockDeductionEligibility";
export { reconcileReservationsForConsumption } from "./stockReservationReconciliation";
export { suppressStockEventFromCustomer } from "./stockFinalizationEvents";
export { createStockFinalizationService } from "./stockFinalizationService";
export {
  createStockFinalizationBundle,
  type StockFinalizationBundle,
  type StockFinalizationPersistenceMode,
} from "./createStockFinalizationBundle";
export { validateConsumptionItemsAgainstReconciliation } from "./stockConsumptionValidation";
export {
  createInMemoryStockBalanceRepository,
  createInMemoryStockMovementRepository,
  createInMemoryStockLineageRepository,
  createInMemoryStockFinalizationEventSink,
} from "./inMemoryStockFinalizationStore";
export {
  createSupabaseStockBalanceRepository,
  createSupabaseStockMovementRepository,
  createSupabaseStockLineageRepository,
} from "./supabaseStockFinalizationStore";
