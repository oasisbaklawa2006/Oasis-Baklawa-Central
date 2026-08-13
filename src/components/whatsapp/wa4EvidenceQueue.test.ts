import { describe, expect, it } from "vitest";
import { summarizeWa4EvidenceQueue } from "@/components/whatsapp/wa4EvidenceQueue";

describe("WA-4 evidence queue", () => {
  it("keeps media failures and ageing fragments visible", () => {
    const now = Date.parse("2026-08-13T13:00:00Z");
    expect(summarizeWa4EvidenceQueue([
      { status: "FAILED_MEDIA", processing_state: "HUMAN_REVIEW", last_received_at: "2026-08-13T12:00:00Z" },
      { status: "AWAITING_MEDIA", processing_state: "PENDING", last_received_at: "2026-08-13T12:55:00Z" },
    ], now)).toEqual({ total: 2, processing: 1, humanReview: 1, ageing: 1 });
  });
});
