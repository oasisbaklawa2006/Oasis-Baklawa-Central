import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ExecutionInternalOnlyBanner } from "../ExecutionInternalOnlyBanner";
import { useExecutionDisplayMode } from "@/hooks/useExecutionDisplayMode";
import { ExecutionBoardTVView } from "../ExecutionBoardTVView";
import { ExecutionNetworkStateBanner } from "../ExecutionNetworkStateBanner";
import { EXECUTION_UX_LABELS } from "@/lib/execution-ux/executionUxConstants";
import type { ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";

const emptyLanes: ExecutionBoardLanes = {
  queue: [],
  blocked: [],
  escalated: [],
  completedToday: [],
  aging: [],
  unowned: [],
};

describe("execution UX hardening", () => {
  it("TV view has no mutation toolbar", () => {
    render(<ExecutionBoardTVView lanes={emptyLanes} lastLoadedAt="2026-05-24T12:00:00.000Z" />);
    expect(screen.getByTestId("execution-board-tv")).toBeTruthy();
    expect(screen.queryByRole("toolbar", { name: /Queue actions/i })).toBeNull();
    expect(screen.getByText(/TV display mode/i)).toBeTruthy();
  });

  it("shows version conflict message", () => {
    render(
      <ExecutionNetworkStateBanner
        lastLoadedAt="2026-05-24T12:00:00.000Z"
        isStale={false}
        loading={false}
        versionConflict
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText(EXECUTION_UX_LABELS.versionConflict)).toBeTruthy();
  });

  it("stale banner exposes retry with aria label", () => {
    render(
      <ExecutionNetworkStateBanner
        lastLoadedAt="2026-05-24T12:00:00.000Z"
        isStale
        loading={false}
        versionConflict={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(EXECUTION_UX_LABELS.retryLoad)).toBeTruthy();
  });

  it("internal only banner has status role", () => {
    render(<ExecutionInternalOnlyBanner />);
    expect(screen.getByRole("status", { name: EXECUTION_UX_LABELS.internalOnly })).toBeTruthy();
  });

  it("useExecutionDisplayMode treats display=tv", () => {
    const { result } = renderHook(() => useExecutionDisplayMode(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/board?display=tv"]}>
          <Routes>
            <Route path="/board" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      ),
    });
    expect(result.current.isTv).toBe(true);
    expect(result.current.mode).toBe("tv");
  });
});
