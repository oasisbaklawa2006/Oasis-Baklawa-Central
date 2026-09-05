import { describe, expect, it, vi } from "vitest";
import { fetchClientGovernanceCounts } from "../clientGovernanceCounts";

function createCountClient(counts: { pending: number; approved: number; active: number }) {
  return {
    from: vi.fn((table: string) => {
      if (table === "companies") {
        return {
          select: vi.fn(async () => ({ count: counts.active, error: null })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(async (_column: string, status: string) => ({
            count: status === "pending" ? counts.pending : counts.approved,
            error: null,
          })),
        })),
      };
    }),
  };
}

describe("fetchClientGovernanceCounts", () => {
  it("returns authoritative pending, approved, and active counts", async () => {
    const supabase = createCountClient({ pending: 2, approved: 5, active: 12 });
    const result = await fetchClientGovernanceCounts(supabase as never);

    expect(result).toEqual({ pending: 2, approved: 5, active: 12 });
    expect(supabase.from).toHaveBeenCalledWith("b2b_applications");
    expect(supabase.from).toHaveBeenCalledWith("companies");
  });

  it("coalesces null counts to zero", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "companies") {
          return {
            select: vi.fn(async () => ({ count: null, error: null })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ count: null, error: null })),
          })),
        };
      }),
    };

    const result = await fetchClientGovernanceCounts(supabase as never);
    expect(result).toEqual({ pending: 0, approved: 0, active: 0 });
  });

  it("surfaces query errors instead of returning stale zeros", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ count: 1, error: new Error("rls denied") })),
        })),
      })),
    };

    await expect(fetchClientGovernanceCounts(supabase as never)).rejects.toThrow("rls denied");
  });
});
