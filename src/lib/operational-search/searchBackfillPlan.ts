import type { SearchIndexUpsertInput } from "./searchIndexTypes";

export interface SearchBackfillSourceEstimate {
  source: string;
  entityType: string;
  estimatedRows: number;
  available: boolean;
  notes: string;
}

export interface SearchBackfillDryRunReport {
  sources: SearchBackfillSourceEstimate[];
  projectedEntryCount: number;
  validationWarnings: string[];
  forbiddenAutomation: string[];
}

/**
 * Contract-only backfill plan — no scheduled jobs, Edge functions, or production backfill.
 */
export function buildSearchBackfillDryRunPlan(estimates: Partial<Record<string, number>> = {}): SearchBackfillDryRunReport {
  const sources: SearchBackfillSourceEstimate[] = [
    {
      source: "projection:order",
      entityType: "order",
      estimatedRows: estimates.orders ?? 0,
      available: true,
      notes: "Index order_number + UUID; customer_safe_candidate when clean",
    },
    {
      source: "projection:queue_item",
      entityType: "queue_item",
      estimatedRows: estimates.queueItems ?? 0,
      available: true,
      notes: "Open + recent queue items; blocker text staff_scoped only",
    },
    {
      source: "projection:operational_event",
      entityType: "operational_event",
      estimatedRows: estimates.events ?? 0,
      available: true,
      notes: "Never index raw unsafe titles into customer_safe_candidate",
    },
    {
      source: "projection:scan_record",
      entityType: "scan_record",
      estimatedRows: estimates.scans ?? 0,
      available: true,
      notes: "Barcode + carton; mismatch/duplicate restricted",
    },
    {
      source: "projection:customer",
      entityType: "customer",
      estimatedRows: estimates.customers ?? 0,
      available: true,
      notes: "Business name + phone/email tokens when present",
    },
    {
      source: "projection:dispatch",
      entityType: "dispatch_reference",
      estimatedRows: estimates.dispatch ?? 0,
      available: false,
      notes: "Requires safe dispatch reference read model — dry-run only",
    },
  ];

  const projectedEntryCount = sources.reduce((n, s) => n + (s.available ? s.estimatedRows : 0), 0);

  return {
    sources,
    projectedEntryCount,
    validationWarnings: [
      "Run migration 20260526020000_execution_os_phase3i_operational_search_index.sql before any manual backfill.",
      "Validate RLS with non-staff account — expect zero rows.",
      "Do not index finance hold / escalation / payment issue into customer_safe_candidate.",
    ],
    forbiddenAutomation: [
      "cron",
      "scheduler",
      "autoIndex",
      "Edge function indexer",
      "production backfill without staging sign-off",
    ],
  };
}

export function buildProjectionEntriesFromDryRun(
  samples: SearchIndexUpsertInput[],
): { entries: SearchIndexUpsertInput[]; count: number } {
  return { entries: samples, count: samples.length };
}
