import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminRouteGuard from "../AdminRouteGuard";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "dispatch-test-user" },
    role: "DISPATCH_MANAGER",
    loading: false,
    profileReady: true,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

/** Mount AdminRouteGuard at a given admin path and return the memory router for location assertions. */
function renderGuardAt(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/admin/finance",
        element: (
          <AdminRouteGuard>
            <div>Finance secret</div>
          </AdminRouteGuard>
        ),
      },
      {
        path: "/admin/dispatch-mgmt",
        element: (
          <AdminRouteGuard>
            <div>
              <span>Dispatch landing</span>
              <Link to="/admin/finance">Try Finance again</Link>
            </div>
          </AdminRouteGuard>
        ),
      },
    ],
    { initialEntries: [initialPath], initialIndex: 0 },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe("AdminRouteGuard repeated forbidden-route enforcement", () => {
  it("never renders Finance and redirects repeated attempts back to the Dispatch destination", async () => {
    const router = renderGuardAt("/admin/finance");

    expect(screen.queryByText("Finance secret")).toBeNull();
    await waitFor(() => {
      expect(screen.getByText("Dispatch landing")).toBeTruthy();
    });
    expect(router.state.location.pathname).toBe("/admin/dispatch-mgmt");

    fireEvent.click(screen.getByRole("link", { name: "Try Finance again" }));

    expect(screen.queryByText("Finance secret")).toBeNull();
    await waitFor(() => {
      expect(screen.getByText("Dispatch landing")).toBeTruthy();
    });
    expect(router.state.location.pathname).toBe("/admin/dispatch-mgmt");
  });
});

describe("AdminRouteGuard synchronous denial", () => {
  it("uses render-time Navigate instead of leaving the forbidden route mounted", async () => {
    const router = renderGuardAt("/admin/finance");

    expect(screen.queryByText("Finance secret")).toBeNull();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin/dispatch-mgmt");
    });
  });
});
