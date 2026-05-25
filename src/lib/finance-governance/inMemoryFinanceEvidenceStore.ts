import { validateFinanceEvidenceInsert } from "./financeEvidenceModel";
import type { FinanceEvidenceRecord } from "./financeGovernanceTypes";

export interface FinanceEvidenceStore {
  insertEvidence(row: Omit<FinanceEvidenceRecord, "id" | "createdAt">): Promise<FinanceEvidenceRecord>;
  listByOrder(orderId: string): Promise<FinanceEvidenceRecord[]>;
}

export function createInMemoryFinanceEvidenceStore(): FinanceEvidenceStore & {
  _all(): FinanceEvidenceRecord[];
} {
  const rows: FinanceEvidenceRecord[] = [];
  return {
    async insertEvidence(row) {
      validateFinanceEvidenceInsert(row);
      const record: FinanceEvidenceRecord = {
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
