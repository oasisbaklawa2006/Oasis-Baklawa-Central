import type { ExceptionReadRecord } from "./exceptionGovernanceTypes";
import { ExceptionGovernanceError } from "./exceptionGovernanceTypes";

export interface CompletionGateInput {
  jobId?: string | null;
  department?: string | null;
  openExceptions: ExceptionReadRecord[];
}

export function openBlockersForJob(openExceptions: ExceptionReadRecord[], jobId: string): ExceptionReadRecord[] {
  return openExceptions.filter(
    (record) =>
      record.status === "open" &&
      (record.category === "blocker" || record.category === "quality_hold") &&
      record.binding.jobId === jobId,
  );
}

export function openQualityHoldsForBinding(
  openExceptions: ExceptionReadRecord[],
  productId: string,
  sku: string,
): ExceptionReadRecord[] {
  return openExceptions.filter(
    (record) =>
      record.status === "open" &&
      record.category === "quality_hold" &&
      record.binding.productId === productId &&
      record.binding.sku === sku,
  );
}

export function assertCompletionNotBlocked(input: CompletionGateInput): void {
  const { jobId, department, openExceptions } = input;
  const blockers = openExceptions.filter((record) => {
    if (record.status !== "open") return false;
    if (record.category !== "blocker" && record.category !== "quality_hold") return false;
    if (jobId && record.binding.jobId === jobId) return true;
    if (department && record.department?.toUpperCase() === department.toUpperCase()) return true;
    return false;
  });

  if (blockers.length > 0) {
    throw new ExceptionGovernanceError(
      "completion_blocked",
      `Cannot complete while ${blockers.length} open blocker/QH exception(s) remain`,
    );
  }
}

export function summarizeOpenExceptions(openExceptions: ExceptionReadRecord[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const record of openExceptions) {
    if (record.status !== "open") continue;
    summary[record.category] = (summary[record.category] ?? 0) + 1;
  }
  return summary;
}
