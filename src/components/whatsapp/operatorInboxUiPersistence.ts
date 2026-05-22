import type { OperatorInboxBulkFilters } from "./operatorInboxBulkFilter";
import { EMPTY_INBOX_BULK_FILTERS } from "./operatorInboxBulkFilter";

const STORAGE_KEY = "oasis_c2b2_operator_inbox_ui_v1";

export interface OperatorInboxPersistedUiState {
  filterQuery: string;
  unansweredOnly: boolean;
  pinnedIds: string[];
  bulkFilters: OperatorInboxBulkFilters;
}

export function loadOperatorInboxUiState(): Partial<OperatorInboxPersistedUiState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<OperatorInboxPersistedUiState>;
  } catch {
    return null;
  }
}

export function saveOperatorInboxUiState(state: OperatorInboxPersistedUiState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function normalizePersistedBulkFilters(
  raw: OperatorInboxBulkFilters | undefined,
): OperatorInboxBulkFilters {
  if (!raw || typeof raw !== "object") return { ...EMPTY_INBOX_BULK_FILTERS };
  return {
    healthAnyOf: Array.isArray(raw.healthAnyOf) ? raw.healthAnyOf : [],
    ageAnyOf: Array.isArray(raw.ageAnyOf) ? raw.ageAnyOf : [],
    intentToneAnyOf: Array.isArray(raw.intentToneAnyOf) ? raw.intentToneAnyOf : [],
  };
}
