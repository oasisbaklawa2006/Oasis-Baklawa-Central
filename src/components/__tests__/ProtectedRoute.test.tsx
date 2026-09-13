import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute, { PROFILE_BOOTSTRAP_TIMEOUT_MS } from "@/components/ProtectedRoute";

const refreshProfile = vi.fn(async () => true);

let mockedAuth = {
  user: { id: "user-1" } as { id: string } | null,
  loading: false,
  profileReady: false,
  isAuthenticated: true,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    ...mockedAuth,
    refreshProfile,
  }),
}));

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/admin/whatsapp"]}>
      <ProtectedRoute>
        <div data-testid="protected-child">Protected content</div>
      </ProtectedRoute>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute fail-closed bootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshProfile.mockClear();
    mockedAuth = {
      user: { id: "user-1" },
      loading: false,
      profileReady: false,
      isAuthenticated: true,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never renders protected children until profileReady succeeds", () => {
    renderProtectedRoute();

    expect(screen.queryByTestId("protected-child")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Verifying session profile" })).toBeInTheDocument();
  });

  it("shows a bounded timeout error instead of exposing protected children", () => {
    renderProtectedRoute();

    act(() => {
      vi.advanceTimersByTime(PROFILE_BOOTSTRAP_TIMEOUT_MS);
    });

    expect(screen.getByTestId("protected-route-bootstrap-timeout")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-child")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry profile check" })).toBeInTheDocument();
  });

  it("retries profile resolution without rendering protected children", () => {
    renderProtectedRoute();

    act(() => {
      vi.advanceTimersByTime(PROFILE_BOOTSTRAP_TIMEOUT_MS);
    });
    act(() => {
      screen.getByRole("button", { name: "Retry profile check" }).click();
    });

    expect(refreshProfile).toHaveBeenCalledWith({ method: "session_restore", forceRefresh: true });
    expect(screen.queryByTestId("protected-child")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Verifying session profile" })).toBeInTheDocument();
  });

  it("renders protected children only after profileReady becomes true", () => {
    const view = renderProtectedRoute();
    expect(screen.queryByTestId("protected-child")).not.toBeInTheDocument();

    mockedAuth.profileReady = true;
    view.rerender(
      <MemoryRouter initialEntries={["/admin/whatsapp"]}>
        <ProtectedRoute>
          <div data-testid="protected-child">Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("protected-child")).toBeInTheDocument();
  });
});
