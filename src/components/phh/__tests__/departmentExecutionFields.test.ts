import { describe, expect, it } from "vitest";
import { executionFieldsForDepartment } from "../departmentExecutionFields";

describe("departmentExecutionFields", () => {
  // Central issue #368 folded the standalone DATES department into
  // FUSION_SWEETS. Historical Dates jobs' p_execution_metadata jsonb was
  // written under the old DATES department using the keys variety/grade/
  // filling, and there is no rekeying migration for that existing data --
  // these keys must never be renamed (e.g. to date_variety) or historical
  // records silently stop displaying.
  it("keeps the original Dates field keys under FUSION_SWEETS", () => {
    const keys = executionFieldsForDepartment("FUSION_SWEETS").map((field) => field.key);
    expect(keys).toContain("variety");
    expect(keys).toContain("grade");
    expect(keys).toContain("filling");
    expect(keys).not.toContain("date_variety");
    expect(keys).not.toContain("date_grade");
    expect(keys).not.toContain("date_filling");
  });

  it("returns an empty array for an unknown or missing department", () => {
    expect(executionFieldsForDepartment(null)).toEqual([]);
    expect(executionFieldsForDepartment("NOT_A_DEPARTMENT")).toEqual([]);
  });
});
