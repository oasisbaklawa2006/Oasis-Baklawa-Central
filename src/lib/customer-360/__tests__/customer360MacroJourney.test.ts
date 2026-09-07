import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appTsx = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf-8");

describe("macro CRM sales journey boundaries", () => {
  it("does not mount operator inbox under /sales routes", () => {
    expect(appTsx).toContain('path="/sales/clients/:companyId"');
    expect(appTsx).not.toMatch(/path="\/sales\/[^"]*"[\s\S]{0,400}<OperatorInbox/);
    expect(appTsx).not.toMatch(/path="\/sales\/[^"]*"[\s\S]{0,400}<WhatsAppInbox/);
  });

  it("scopes sales Customer 360 behind sales dashboard roles", () => {
    expect(appTsx).toContain('<Customer360Page variant="sales" />');
    expect(appTsx).toContain("SALES_DASHBOARD_ROLES");
  });
});
