import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOrderAmendmentFormControls } from "../useOrderAmendmentFormControls";

describe("useOrderAmendmentFormControls", () => {
  it("exposes named handlers without inline void arrow shorthand", () => {
    const { result } = renderHook(() =>
      useOrderAmendmentFormControls({
        setReason: vi.fn(),
        setSelectedItemId: vi.fn(),
        setSubstituteProductId: vi.fn(),
        setSubstituteQty: vi.fn(),
        loadItems: vi.fn(async () => undefined),
        submitGovernedChange: vi.fn(async () => undefined),
      }),
    );

    expect(result.current.handleReasonChange.name).toBe("onReasonChange");
    expect(result.current.handleAmendClick.name).toBe("onAmendClick");
    expect(result.current.handleCancelClick.name).toBe("onCancelClick");
    expect(result.current.handleSubstituteClick.name).toBe("onSubstituteClick");
  });
});
