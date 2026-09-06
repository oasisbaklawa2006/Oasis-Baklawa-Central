import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminRouteGuard from "../AdminRouteGuard";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "dispatch-test-user" },
    role: "DISPATCH_MANAGER",
    loading: false,
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

function GuardedRoutes() {
  return (
    <AdminRouteGuard>
      <Routes>
        <Route path="/admin/finance" element={<div>Finance secret</div>} />
        <Route
          path="/admin/dispatch-mgmt"
          element={
            <div>
              <span>Dispatch landing</span>
              <Link to="/admin/finance">Try Finance again</Link>
            </div>
          }
        />
      </Routes>
    </AdminRouteGuard>
  );
}

describe("AdminRouteGuard repeated forbidden-route enforcement", () => {
  it("never renders Finance and redirects repeated attempts back to the Dispatch destination", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/finance"]}>
        <GuardedRoutes />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Finance secret")).toBeNull();
    expect(await screen.findByText("Dispatch landing")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Try Finance again" }));

    expect(screen.queryByText("Finance secret")).toBeNull();
    expect(await screen.findByText("Dispatch landing")).toBeTruthy();
  });
});
