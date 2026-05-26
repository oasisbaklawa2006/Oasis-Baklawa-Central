import { validateEvidenceInsert } from "./dispatchReadinessEvidence";
import type { DispatchEvidenceRecord } from "./dispatchReadinessTypes";

export interface DispatchEvidenceStore {
  insertEvidence(row: Omit<DispatchEvidenceRecord, "id" | "createdAt">): Promise<DispatchEvidenceRecord>;
  listByOrder(orderId: string): Promise<DispatchEvidenceRecord[]>;
}

export function createInMemoryDispatchEvidenceStore(): DispatchEvidenceStore & {
  _all(): DispatchEvidenceRecord[];
} {
  const rows: DispatchEvidenceRecord[] = [];

  return {
    async insertEvidence(row) {
      validateEvidenceInsert(row);
      const record: DispatchEvidenceRecord = {
        ...row,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      rows.push(record);
      return record;
    },

    async listByOrder(orderId) {
      return rows.filter((r) => r.orderId === orderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    _all() {
      return [...rows];
    },
  };
}
