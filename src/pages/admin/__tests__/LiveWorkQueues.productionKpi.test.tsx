import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LiveWorkQueues from "../LiveWorkQueues";

// Regression coverage: the Command Center "Production" KPI was ambiguous --
// a card labeled "Production" on this page counted legacy orders.status
// pipeline membership, completely disconnected from the governed
// production_jobs authority (see openProductionJobsCount.ts). This test
// asserts the two numbers are never shown under the same "Production"
// label again.

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
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/useOpenProductionJobsCount", () => ({
  useOpenProductionJobsCount: () => ({
    count: 6,
    error: null,
    loading: false,
    refresh: vi.fn(),
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

    // Authoritative production_jobs count, clearly labeled.
    expect(screen.getByText("Production Jobs (Governed)")).toBeInTheDocument();
    expect(screen.getByTestId("production-jobs-governed-card")).toHaveTextContent("6");

    // Legacy orders-pipeline queue card, renamed away from the bare
    // "Production" label so the two numbers can never be mistaken for
    // the same metric.
    expect(screen.getByText("Orders in Production Pipeline")).toBeInTheDocument();
    expect(screen.queryByText(/^Production$/)).not.toBeInTheDocument();
  });
});
