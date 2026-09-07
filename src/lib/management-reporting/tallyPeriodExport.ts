/**
 * Deterministic period/company Tally-style batch export (v2).
 * Read-only — does not mutate canonical accounting/payment records.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildTallyBridgeV1Csv,
  fetchTallyBridgeV1ExportData,
  isOrderReadyForTallyExportV1,
} from "@/utils/tallyExportV1";
import type { TallyExportAuditMetadata } from "./managementReportingTypes";

export interface TallyPeriodExportFilter {
  periodStart: string;
  periodEnd: string;
  companyId?: string | null;
}

export interface TallyPeriodExportLine {
  orderId: string;
  csv: string;
  lineCount: number;
  warnings: string[];
}

export interface TallyPeriodExportResult {
  ok: true;
  combinedCsv: string;
  filename: string;
  orderCount: number;
  lineCount: number;
  warnings: string[];
  audit: TallyExportAuditMetadata;
  perOrder: TallyPeriodExportLine[];
}

export interface TallyPeriodExportError {
  ok: false;
  error: string;
  warnings?: string[];
}

/** FNV-1a 32-bit hash for deterministic export evidence. */
export function hashExportContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function escapeCsvCell(value: string | number): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[\r\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildAuditHeaderRows(audit: TallyExportAuditMetadata): string[] {
  return [
    "# Tally Period Export v2 — governed read-only export",
    `# export_id=${audit.exportId}`,
    `# generated_at=${audit.generatedAtIso}`,
    `# period_start=${audit.periodStart}`,
    `# period_end=${audit.periodEnd}`,
    `# company_id=${audit.companyId ?? "ALL"}`,
    `# order_count=${audit.orderCount}`,
    `# line_count=${audit.lineCount}`,
    `# content_hash=${audit.contentHash}`,
    `# source=${audit.source}`,
    "",
  ];
}

export async function exportTallyPeriodBatch(
  client: SupabaseClient<Database>,
  filter: TallyPeriodExportFilter,
  options?: { exportId?: string; generatedAtIso?: string },
): Promise<TallyPeriodExportResult | TallyPeriodExportError> {
  const start = new Date(filter.periodStart);
  const end = new Date(filter.periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Invalid period dates." };
  }
  if (start > end) {
    return { ok: false, error: "Period start must be before period end." };
  }

  let query = client
    .from("orders")
    .select("id, status, company_id, created_at")
    .gte("created_at", filter.periodStart)
    .lte("created_at", filter.periodEnd)
    .in("status", ["dispatched", "delivered", "closed"]);

  if (filter.companyId) {
    query = query.eq("company_id", filter.companyId);
  }

  const { data: orders, error } = await query.order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const eligible = (orders ?? []).filter((o) => isOrderReadyForTallyExportV1(o.status));
  if (eligible.length === 0) {
    return {
      ok: false,
      error: "No export-ready orders in the selected period/company filter.",
    };
  }

  const allWarnings: string[] = [];
  const perOrder: TallyPeriodExportLine[] = [];
  const dataRows: string[] = [];
  let headerLine: string | null = null;
  let totalLines = 0;

  for (const order of eligible) {
    const fetched = await fetchTallyBridgeV1ExportData(client, order.id);
    if ("error" in fetched) {
      allWarnings.push(`Order ${order.id.slice(0, 8)}… skipped: ${fetched.error}`);
      continue;
    }
    const built = buildTallyBridgeV1Csv(fetched.data);
    if (built.ok === false) {
      allWarnings.push(`Order ${order.id.slice(0, 8)}… skipped: ${built.error}`);
      allWarnings.push(...built.warnings);
      continue;
    }
    const lines = built.csv.split(/\r?\n/);
    if (lines.length <= 1) continue;
    if (!headerLine) headerLine = lines[0];
    dataRows.push(...lines.slice(1));
    totalLines += lines.length - 1;
    allWarnings.push(...built.warnings);
    perOrder.push({
      orderId: order.id,
      csv: built.csv,
      lineCount: lines.length - 1,
      warnings: built.warnings,
    });
  }

  if (totalLines === 0 || !headerLine) {
    return {
      ok: false,
      error: "No exportable Tally lines after processing eligible orders.",
      warnings: allWarnings,
    };
  }

  const generatedAtIso = options?.generatedAtIso ?? new Date().toISOString();
  const exportId = options?.exportId ?? `tally-v2-${generatedAtIso.slice(0, 10)}-${eligible.length}`;
  const bodyCsv = [headerLine, ...dataRows].join("\r\n");

  const audit: TallyExportAuditMetadata = {
    exportId,
    generatedAtIso,
    periodStart: filter.periodStart,
    periodEnd: filter.periodEnd,
    companyId: filter.companyId ?? null,
    orderCount: perOrder.length,
    lineCount: totalLines,
    contentHash: hashExportContent(bodyCsv),
    source: "tally_period_export_v2",
  };

  const combinedCsv = [...buildAuditHeaderRows(audit), bodyCsv].join("\r\n");
  const stamp = generatedAtIso.slice(0, 19).replace(/[:T]/g, "-");
  const companySuffix = filter.companyId ? filter.companyId.slice(0, 8) : "all";
  const filename = `tally-period-v2-${companySuffix}-${stamp}.csv`;

  return {
    ok: true,
    combinedCsv,
    filename,
    orderCount: perOrder.length,
    lineCount: totalLines,
    warnings: allWarnings,
    audit,
    perOrder,
  };
}

/** Deterministic regeneration check — same inputs produce same content hash. */
export function verifyExportDeterminism(
  firstHash: string,
  secondHash: string,
): boolean {
  return firstHash === secondHash;
}

export type TallyExportReproducibilityResult =
  | { ok: true; contentHash: string }
  | { ok: false; expected: string; actual: string; error?: string };

/** Re-run export and compare body content hash for reproducibility evidence. */
export async function verifyTallyExportReproducibility(
  client: SupabaseClient<Database>,
  filter: TallyPeriodExportFilter,
  expectedContentHash: string,
): Promise<TallyExportReproducibilityResult> {
  const result = await exportTallyPeriodBatch(client, filter);
  if (result.ok === false) {
    return { ok: false, expected: expectedContentHash, actual: "", error: result.error };
  }
  if (result.audit.contentHash === expectedContentHash) {
    return { ok: true, contentHash: result.audit.contentHash };
  }
  return { ok: false, expected: expectedContentHash, actual: result.audit.contentHash };
}

export function buildExportSummaryRow(audit: TallyExportAuditMetadata): string {
  return [
    audit.exportId,
    audit.generatedAtIso,
    audit.periodStart,
    audit.periodEnd,
    audit.companyId ?? "ALL",
    audit.orderCount,
    audit.lineCount,
    audit.contentHash,
  ]
    .map(escapeCsvCell)
    .join(",");
}
