import { validateCompletionEvidenceInsert } from "./dispatchCompletionEvidence";
import type { DispatchCompletionEvidenceRecord } from "./dispatchCompletionTypes";

export interface DispatchCompletionEvidenceStore {
  insertEvidence(
    row: Omit<DispatchCompletionEvidenceRecord, "id" | "createdAt">,
  ): Promise<DispatchCompletionEvidenceRecord>;
  listByOrder(orderId: string): Promise<DispatchCompletionEvidenceRecord[]>;
}

export function createInMemoryDispatchCompletionEvidenceStore(): DispatchCompletionEvidenceStore {
  const rows: DispatchCompletionEvidenceRecord[] = [];

  return {
    async insertEvidence(row) {
      validateCompletionEvidenceInsert(row);
      const record: DispatchCompletionEvidenceRecord = {
        ...row,
        id: `mem-dce-${rows.length + 1}`,
        createdAt: new Date().toISOString(),
      };
      rows.push(record);
      return record;
    },
    async listByOrder(orderId) {
      return rows.filter((r) => r.orderId === orderId);
    },
  };
}
