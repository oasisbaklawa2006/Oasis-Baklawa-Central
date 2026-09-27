import { describe, expect, it } from "vitest";
import {
  ASSEMBLY_TERMINAL_STATUSES,
  ASSEMBLY_TV_PENDING_STATUSES,
  ASSEMBLY_TV_PARTIAL_STATUSES,
  ASSEMBLY_TV_READY_STATUSES,
  assemblyJobTvProgress,
  classifyAssemblyJobForTvColumn,
  isActiveAssemblyJob,
  type AssemblyJobTvRow,
} from "../assemblyJobReadBoundary";

function job(overrides: Partial<AssemblyJobTvRow> = {}): AssemblyJobTvRow {
  return {
    id: "job-1",
    assembly_job_number: "ASM-TEST-001",
    order_id: "order-1",
    output_product_id: "prod-1",
    output_sku: "HAMPER-1",
    planned_qty: 10,
    completed_qty: 0,
    accepted_qty: 0,
    rejected_qty: 0,
    status: "planned",
    created_at: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("assemblyJobReadBoundary", () => {
  it("classifies governed job statuses into TV columns without overlap", () => {
    for (const status of ASSEMBLY_TV_READY_STATUSES) {
      expect(classifyAssemblyJobForTvColumn(status)).toBe("ready");
    }
    for (const status of ASSEMBLY_TV_PARTIAL_STATUSES) {
      expect(classifyAssemblyJobForTvColumn(status)).toBe("partial");
    }
    for (const status of ASSEMBLY_TV_PENDING_STATUSES) {
      expect(classifyAssemblyJobForTvColumn(status)).toBe("pending");
    }
  });

  it("treats job_closed and cancelled as inactive terminal states", () => {
    for (const status of ASSEMBLY_TERMINAL_STATUSES) {
      expect(isActiveAssemblyJob(status)).toBe(false);
    }
    expect(isActiveAssemblyJob("issued")).toBe(true);
  });

  it("binds TV progress to accepted qty for ready jobs and completed qty for partial jobs", () => {
    expect(assemblyJobTvProgress(job({ status: "accepted", accepted_qty: 8 }))).toEqual({
      numerator: 8,
      denominator: 10,
      pct: 80,
    });
    expect(assemblyJobTvProgress(job({ status: "in_progress", completed_qty: 5 }))).toEqual({
      numerator: 5,
      denominator: 10,
      pct: 50,
    });
    expect(assemblyJobTvProgress(job({ status: "planned" }))).toEqual({
      numerator: 0,
      denominator: 10,
      pct: 0,
    });
  });

  it("preserves exact job identity fields required for operator reconciliation", () => {
    const row = job({
      assembly_job_number: "ASM-SO123-ABCD1234",
      order_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      output_sku: "GIFT-BOX-2",
    });
    expect(row.assembly_job_number).toBe("ASM-SO123-ABCD1234");
    expect(row.order_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(row.output_sku).toBe("GIFT-BOX-2");
  });
});
