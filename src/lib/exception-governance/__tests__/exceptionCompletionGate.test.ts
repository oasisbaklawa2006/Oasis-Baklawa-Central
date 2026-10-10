import { describe, expect, it } from "vitest";
import { assertCompletionNotBlocked, summarizeOpenExceptions } from "../exceptionCompletionGate";
import { ExceptionGovernanceError } from "../exceptionGovernanceTypes";
import type { ExceptionReadRecord } from "../exceptionGovernanceTypes";

const openBlocker: ExceptionReadRecord = {
  id: "ex-1",
  category: "blocker",
  status: "open",
  subsystem: "PRODUCTION",
  binding: { subsystem: "PRODUCTION", jobId: "job-1", department: "ARABIC_SWEETS" },
  reason: "Equipment fault",
  reasonCode: "equipment_failure",
  department: "ARABIC_SWEETS",
  quantities: {},
  reportedAt: "2026-09-01T00:00:00Z",
  resolvedAt: null,
};

describe("exceptionCompletionGate", () => {
  it("blocks completion when open blocker exists for job", () => {
    expect(() =>
      assertCompletionNotBlocked({
        jobId: "job-1",
        department: "ARABIC_SWEETS",
        openExceptions: [openBlocker],
      }),
    ).toThrow(ExceptionGovernanceError);
  });

  it("allows completion when blockers are resolved", () => {
    assertCompletionNotBlocked({
      jobId: "job-1",
      openExceptions: [{ ...openBlocker, status: "resolved" }],
    });
  });

  it("summarizes open exceptions by category", () => {
    const summary = summarizeOpenExceptions([
      openBlocker,
      { ...openBlocker, id: "ex-2", category: "quality_hold" },
      { ...openBlocker, id: "ex-3", status: "resolved" },
    ]);
    expect(summary).toEqual({ blocker: 1, quality_hold: 1 });
  });
});
