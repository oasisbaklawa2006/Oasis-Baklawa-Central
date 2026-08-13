export type Wa4PacketRow = {
  status: string;
  processing_state: string;
  last_received_at: string;
};

export function summarizeWa4EvidenceQueue(rows: Wa4PacketRow[], nowMs = Date.now()) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (["FAILED_MEDIA"].includes(row.status) || row.processing_state === "HUMAN_REVIEW") summary.humanReview += 1;
      if (row.status === "AWAITING_MEDIA" || ["PENDING", "PROCESSING"].includes(row.processing_state)) summary.processing += 1;
      if (nowMs - new Date(row.last_received_at).getTime() >= 30 * 60_000) summary.ageing += 1;
      return summary;
    },
    { total: 0, processing: 0, humanReview: 0, ageing: 0 },
  );
}
