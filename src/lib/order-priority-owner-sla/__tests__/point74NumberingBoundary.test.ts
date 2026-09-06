import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Point74 numbering boundary — original #459 vs CRM-lite drift", () => {
  const crmEvidence = source("docs/CRM_LITE_POINT_74_CLOSURE_EVIDENCE.md");

  it("documents CRM-lite #444/#449 as separate from original Point74 order authority", () => {
    expect(crmEvidence).toContain("CRM-lite");
    expect(crmEvidence).toContain("#449");
  });

  it("keeps original Point74 module scoped to order priority/owner/SLA", () => {
    const boundary = source("src/lib/order-priority-owner-sla/orderPriorityOwnerSlaTypes.ts");
    expect(boundary).toContain("Original Point74 (#459)");
    expect(boundary).toContain("Not CRM-lite #444/#449");
    expect(boundary).toContain("staff_sales_order_priority_owner_sla_facts_v1");
  });

  it("does not claim CRM-lite assist panel as Point74 authority", () => {
    const assistPanel = source("src/components/sales/crm-lite/SalesCrmAssistPanel.tsx");
    expect(assistPanel).toContain('data-point="74"');
    const point74Module = source("src/lib/order-priority-owner-sla/index.ts");
    expect(point74Module).not.toContain("SalesCrmAssistPanel");
    expect(point74Module).not.toContain("crm_tasks");
  });
});
