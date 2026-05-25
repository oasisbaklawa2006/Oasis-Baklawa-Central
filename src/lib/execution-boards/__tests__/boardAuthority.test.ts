import { describe, expect, it } from "vitest";
import { hasAdminModuleAccess } from "@/lib/auth/adminModuleAccess";
import { canExecuteOnBoard, canExecuteOnQueue } from "../boardAuthority";
import { DEPARTMENT_BOARDS } from "../departmentBoardConfig";

describe("boardAuthority", () => {
  it("allows production manager on production queue", () => {
    expect(canExecuteOnQueue("PRODUCTION_MANAGER", "production_queue")).toBe(true);
  });

  it("denies finance exec on production queue", () => {
    expect(canExecuteOnQueue("FINANCE_EXEC", "production_queue")).toBe(false);
  });

  it("dispatch board execute for dispatch manager", () => {
    expect(canExecuteOnBoard("DISPATCH_MANAGER", DEPARTMENT_BOARDS.dispatch.queueTypes)).toBe(true);
  });

  it("route module parity for complaints board", () => {
    expect(hasAdminModuleAccess("SUPPORT_EXECUTIVE", DEPARTMENT_BOARDS.complaints.moduleKey)).toBe(true);
    expect(hasAdminModuleAccess("PRODUCTION_MANAGER", DEPARTMENT_BOARDS.complaints.moduleKey)).toBe(false);
  });
});
