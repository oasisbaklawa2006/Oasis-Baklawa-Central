import type { TallyExportAuditMetadata } from "./managementReportingTypes";

const STORAGE_KEY = "management-reporting-export-history-v1";
const MAX_ENTRIES = 50;

export interface StoredExportRecord extends TallyExportAuditMetadata {
  filename: string;
  storedAtIso: string;
}

function readRaw(): StoredExportRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredExportRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(records: StoredExportRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_ENTRIES)));
}

export function listExportHistory(): StoredExportRecord[] {
  return readRaw();
}

export function appendExportHistory(
  audit: TallyExportAuditMetadata,
  filename: string,
): StoredExportRecord {
  const record: StoredExportRecord = {
    ...audit,
    filename,
    storedAtIso: new Date().toISOString(),
  };
  const next = [record, ...readRaw().filter((r) => r.exportId !== record.exportId)];
  writeRaw(next);
  return record;
}

export function clearExportHistory(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
