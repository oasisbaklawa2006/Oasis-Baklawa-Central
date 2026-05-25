import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionQueueBoard } from "../ExecutionQueueBoard";
import type { ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";

const empty: ExecutionBoardLanes = {
  queue: [],
  blocked: [],
  escalated: [],
  completedToday: [],
  aging: [],
  unowned: [],
};

describe("ExecutionQueueBoard", () => {
  it("renders lane headings", () => {
    render(<ExecutionQueueBoard lanes={empty} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Queue \(0\)/)).toBeTruthy();
    expect(screen.getByText(/Blocked \(0\)/)).toBeTruthy();
  });
});
