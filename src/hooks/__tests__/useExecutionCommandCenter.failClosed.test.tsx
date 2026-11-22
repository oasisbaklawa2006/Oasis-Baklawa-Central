import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExecutionCommandCenter } from "../useExecutionCommandCenter";

const mocks = vi.hoisted(() => ({
  canonicalRead: vi.fn(),
  projectionBuilder: vi.fn(() => ({ globalQueuePressure: { open: 9 } })),
  refreshFeeds: vi.fn(),
}));

vi.mock("@/lib/department-queues", () => ({
  fetchCanonicalDepartmentQueueItems: mocks.canonicalRead,
  toExecutionIntelligenceQueueItems: vi.fn(() => []),
}));

vi.mock("@/lib/execution-intelligence", () => ({
  buildExecutionCommandCenterProjection: mocks.projectionBuilder,
}));

vi.mock("@/hooks/useOperationalLiveFeeds", () => {
  const feeds = { snapshots: [], allWarnings: [] };
  return {
    useOperationalLiveFeeds: () => ({
      feeds,
      loading: false,
      error: null,
      refresh: mocks.refreshFeeds,
    }),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: [], error: null }),
      };
      return builder;
    },
  },
}));

describe("useExecutionCommandCenter canonical failure state (Factory F46)", () => {
  beforeEach(() => {
    mocks.canonicalRead.mockReset();
    mocks.projectionBuilder.mockClear();
    mocks.refreshFeeds.mockClear();
  });

  it("exposes the Core error and no zero-workload projection even when live feeds are present", async () => {
    mocks.canonicalRead.mockRejectedValue(new Error("b2b_dispatch_consignments read failed: relation does not exist"));
    const { result } = renderHook(() => useExecutionCommandCenter());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain("b2b_dispatch_consignments read failed");
    expect(result.current.projection).toBeNull();
    expect(mocks.projectionBuilder).not.toHaveBeenCalled();
    expect(result.current.feeds).toBeDefined();
  });

  it("removes a previously successful projection when a refreshed canonical read fails", async () => {
    mocks.canonicalRead
      .mockResolvedValueOnce({ items: [] })
      .mockRejectedValue(new Error("inventory_reservations read failed: permission denied"));
    const { result } = renderHook(() => useExecutionCommandCenter());

    await waitFor(() => expect(result.current.projection).not.toBeNull());
    expect(mocks.projectionBuilder).toHaveBeenCalledTimes(1);

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toContain("inventory_reservations read failed"));

    expect(result.current.projection).toBeNull();
    expect(mocks.projectionBuilder).toHaveBeenCalledTimes(1);
  });
});
