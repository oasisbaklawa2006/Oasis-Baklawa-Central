import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeSupportTicketSlaState,
  isSupportTicketActive,
  isSupportTicketSlaBreached,
} from "../supportTicketPolicy";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

const NOW = new Date("2026-10-01T10:00:00.000Z");

/** Minimal chainable query-builder stub mirroring the Supabase fluent API used by the loader. */
function makeTicketsChain(pages: Array<{ data: unknown[]; error: { message: string } | null }>) {
  const orCalls: string[] = [];
  let callIndex = 0;
  const chain = {
    select: vi.fn(() => chain),
    or: vi.fn((filter: string) => {
      orCalls.push(filter);
      return chain;
    }),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then(resolve: (value: unknown) => unknown) {
      const page = pages[Math.min(callIndex, pages.length - 1)];
      callIndex += 1;
      return Promise.resolve(page).then(resolve);
    },
  };
  return { chain, orCalls };
}

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
  beforeEach(() => {
    fromMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("paginates the active support-ticket population with a stable keyset cursor, not offset/range", async () => {
    const { loadActiveSupportTicketsPaginated } = await import("../supportTicketQueries");

    const pageOne = Array.from({ length: 500 }, (_, i) => ({
      id: `t-${i}`,
      status: "open",
      created_at: "2026-10-01T10:00:00.000Z",
    }));
    const pageTwo = [{ id: "t-500", status: "open", created_at: "2026-09-30T10:00:00.000Z" }];
    const { chain, orCalls } = makeTicketsChain([
      { data: pageOne, error: null },
      { data: pageTwo, error: null },
    ]);
    fromMock.mockReturnValue(chain);

    const result = await loadActiveSupportTicketsPaginated();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(501);
    // First request carries only the active-status filter; the second request
    // is anchored to the last row of the first page via a keyset cursor, not
    // a recomputed offset — so a row inserted ahead of the boundary between
    // requests cannot shift it and duplicate or skip an active ticket.
    expect(orCalls).toHaveLength(3);
    expect(orCalls[2]).toContain("created_at.lt.2026-10-01T10:00:00.000Z");
    expect(orCalls[2]).toContain("id.gt.t-499");

    const source = readFileSync("src/lib/support/supportTicketQueries.ts", "utf8");
    expect(source).not.toContain(".range(");
  });

  it("surfaces a read failure instead of silently returning an empty population", async () => {
    const { loadActiveSupportTicketsPaginated } = await import("../supportTicketQueries");
    const { chain } = makeTicketsChain([{ data: [], error: { message: "connection reset" } }]);
    fromMock.mockReturnValue(chain);

    const result = await loadActiveSupportTicketsPaginated();

    expect(result.error).toEqual({ message: "connection reset" });
    expect(result.data).toEqual([]);
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
