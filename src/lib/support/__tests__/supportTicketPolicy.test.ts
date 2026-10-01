import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeSupportTicketSlaState,
  isSupportTicketActive,
  isSupportTicketSlaBreached,
} from "../supportTicketPolicy";

const NOW = new Date("2026-10-01T10:00:00.000Z");

describe("supportTicketPolicy", () => {
  it.each(["resolved", "closed", "rejected", "cancelled", "CANCELLED"])(
    "treats %s as terminal",
    (status) => {
      expect(isSupportTicketActive({ status })).toBe(false);
    },
  );

  it("keeps actionable statuses active", () => {
    expect(isSupportTicketActive({ status: "open" })).toBe(true);
    expect(isSupportTicketActive({ status: "in_progress" })).toBe(true);
  });

  it("preserves an on-time resolved ticket as on time after the due date has passed", () => {
    expect(
      computeSupportTicketSlaState(
        {
          status: "resolved",
          sla_resolution_due: "2026-10-01T09:00:00.000Z",
          sla_resolved_at: "2026-10-01T08:30:00.000Z",
        },
        NOW,
      ),
    ).toBe("On Time");
  });

  it("marks a late resolution as breached instead of hardcoding On Time", () => {
    expect(
      computeSupportTicketSlaState(
        {
          status: "resolved",
          sla_first_response_at: "2026-10-01T07:30:00.000Z",
          sla_resolution_due: "2026-10-01T09:00:00.000Z",
          sla_resolved_at: "2026-10-01T09:30:00.000Z",
        },
        NOW,
      ),
    ).toBe("Late");
  });

  it("marks an unresolved ticket with no response beyond resolution due as NEVER_RESPONDED", () => {
    const ticket = {
      status: "open",
      sla_first_response_due: "2026-10-01T07:00:00.000Z",
      sla_resolution_due: "2026-10-01T09:00:00.000Z",
      sla_first_response_at: null,
    };
    expect(computeSupportTicketSlaState(ticket, NOW)).toBe("NEVER_RESPONDED");
    expect(isSupportTicketSlaBreached(ticket, NOW)).toBe(true);
  });

  it("does not report terminal tickets as current breached work", () => {
    expect(
      isSupportTicketSlaBreached(
        {
          status: "cancelled",
          sla_resolution_due: "2026-09-30T09:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
  });
});


describe("support ticket query completeness", () => {
  it("paginates the active support-ticket population with a stable range cursor", () => {
    const source = readFileSync("src/lib/support/supportTicketQueries.ts", "utf8");
    expect(source).toContain('.select("*", { count: "exact" })');
    expect(source).toContain(".range(offset, offset + SUPPORT_TICKET_PAGE_SIZE - 1)");
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain('.order("id", { ascending: true })');
  });

  it.each([
    "src/hooks/useManagementCommandCenter.ts",
    "src/pages/admin/AdminDashboard.tsx",
    "src/pages/admin/AdminExceptions.tsx",
  ])("%s consumes the shared paginated loader", (path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain("loadActiveSupportTicketsPaginated");
    expect(source).not.toMatch(/from\(["']support_tickets["']\)\.select/);
  });
});
