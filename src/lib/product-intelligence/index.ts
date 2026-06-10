export type {
  ApprovedAliasCatalog,
  IntelligenceAliasRow,
  IntelligenceCandidate,
  IntelligenceProductRow,
  ProductIntelligenceResolution,
} from "./types";
export { isGenericFamilyUtterance, GENERIC_FAMILY_TERMS } from "./genericTerms";
export { loadApprovedAliasCatalog } from "./loadApprovedAliasCatalog";
export { resolveProductIntelligence } from "./resolveProductIntelligence";
export {
  createProductIntelligenceService,
  type ProductIntelligenceService,
} from "./productIntelligenceService";
export { PROTOTYPE_APPROVED_CATALOG } from "./fixtures/prototypeCatalog";
