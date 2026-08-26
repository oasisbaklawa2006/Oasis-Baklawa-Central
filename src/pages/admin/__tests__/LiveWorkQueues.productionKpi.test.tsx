import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LiveWorkQueues from "../LiveWorkQueues";

// Regression coverage: the Command Center "Production" KPI was ambiguous --
// a card labeled "Production" on this page counted legacy orders.status
// pipeline membership, completely disconnected from the governed
// production_jobs authority (see openProductionJobsCount.ts). This suite
// also proves the page refresh reloads both projections together.

const { refreshOperationalFeeds, refreshProductionJobs } = vi.hoisted(() => ({
  refreshOperationalFeeds: vi.fn(),
  refreshProductionJobs: vi.fn(),
}));

vi.mock("@/hooks/useOperationalLiveFeeds", () => ({
  useOperationalLiveFeeds: () => ({
    loading: false,
    error: null,
    feeds: {
      byQueue: {},
      snapshots: [
        { queueId: "production_queue", label: "Orders in Production Pipeline", items: [], pressureCount: 3, generatedAt: "" },
      ],
      cmdPressure: { unifiedBlockerContext: "", unifiedRootBlocker: null },
      allWarnings: [],
    },
    refresh: refreshOperationalFeeds,
  }),
}));

vi.mock("@/hooks/useOpenProductionJobsCount", () => ({
  useOpenProductionJobsCount: () => ({
    count: 6,
    error: null,
    loading: false,
    refresh: refreshProductionJobs,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("LiveWorkQueues Production KPI", () => {
  it("shows the governed production_jobs count and the orders-pipeline count under distinct labels", () => {
    render(
      <MemoryRouter>
        <LiveWorkQueues />
      </MemoryRouter>,
    );

    expect(screen.getByText("Production Jobs (Governed)")).toBeInTheDocument();
    expect(screen.getByTestId("production-jobs-governed-card")).toHaveTextContent("6");

    expect(screen.getByText("Orders in Production Pipeline")).toBeInTheDocument();
    expect(screen.queryByText(/^Production$/)).not.toBeInTheDocument();
  });

  it("refreshes both operational feeds and the governed production_jobs KPI", () => {
    render(
      <MemoryRouter>
        <LiveWorkQueues />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refreshOperationalFeeds).toHaveBeenCalledTimes(1);
    expect(refreshProductionJobs).toHaveBeenCalledTimes(1);
  });
});
