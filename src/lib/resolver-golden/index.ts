export type { GoldenExpectedOutcome, GoldenUtteranceCase, GoldenUtteranceCategory } from "./types";
export { GOLDEN_UTTERANCE_MATRIX, goldenMatrixStats } from "./goldenUtteranceMatrix";
export {
  assertGoldenMatrixOracleConsistency,
  findNormalizedOracleConflicts,
  normalizeGoldenUtterance,
} from "./goldenMatrixValidation";
export type { NormalizedOracleConflict } from "./goldenMatrixValidation";
