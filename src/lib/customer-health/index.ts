export type {
  CustomerHealthAdvisoryActionCapability,
  CustomerHealthCategory,
  CustomerHealthNextBestAction,
  CustomerHealthProjectionInput,
  CustomerHealthReadModel,
  CustomerHealthRiskDimension,
  CustomerHealthRiskLevel,
  CustomerHealthSignalAvailability,
  CustomerHealthSignalFact,
  CustomerHealthSignalId,
  CustomerHealthUnavailableSignal,
} from "./customerHealthTypes";

export { extractCustomerHealthSignals } from "./customerHealthSignals";
export { buildCustomerHealthProjection, deriveNextBestActions } from "./customerHealthProjection";
