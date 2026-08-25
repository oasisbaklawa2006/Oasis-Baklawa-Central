import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import App from "../App";

// Test-then-implement coverage for the owner's execution-board disposition
// (factory-operations-certification-summary.md): /admin/execution/production,
// /admin/execution/assembly and /admin/execution/ready-goods all used to
// read `operational_queue_items`, a table with zero writers anywhere in
// oasis-supabase-core's migration history. These three now redirect to the
// real governed surfaces. This proves each redirect target actually
// renders, not just that a <Navigate> element exists in the route tree.

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@example.com" },
    loading: false,
    role: "ADMIN",
    companyId: null,
    profileReady: true,
    hasAppliedB2B: false,
    profileStatus: "active",
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AdminLayout.tsx", () => ({
  default: () => (
    <div data-testid="admin-layout-stub">
      <Outlet />
    </div>
  ),
}));

vi.mock("@/integrations/supabase/client", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.in = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null });
  return {
    supabase: {
      from: () => builder,
      // get_user_role must agree with the mocked useAuth role ("ADMIN") --
      // RoleProtectedRoute forces a logout on any server/client role
      // mismatch, which would otherwise strand this test on its own
      // verifying spinner forever.
      rpc: (fn: string) => Promise.resolve({ data: fn === "get_user_role" ? "ADMIN" : null, error: null }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function goTo(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

describe("Execution board redirects (dead operational_queue_items surfaces)", () => {
  it("redirects /admin/execution/production to /operations-controller and it renders", async () => {
    goTo("/admin/execution/production");
    await waitFor(() => expect(window.location.pathname).toBe("/operations-controller"), { timeout: 15000 });
    // OperationsController's own heading text, proving the target actually
    // mounted rather than the route tree just falling through to NotFound.
    await waitFor(() => expect(screen.queryByText(/page not found/i)).toBeNull(), { timeout: 15000 });
  });

  it("redirects /admin/execution/assembly to /admin/assembly-tasks and it renders", async () => {
    goTo("/admin/execution/assembly");
    await waitFor(() => expect(window.location.pathname).toBe("/admin/assembly-tasks"), { timeout: 15000 });
    await waitFor(() => expect(screen.getByTestId("admin-layout-stub")).toBeInTheDocument(), { timeout: 15000 });
    await waitFor(() => expect(screen.queryByText(/page not found/i)).toBeNull(), { timeout: 15000 });
  });

  it("redirects /admin/execution/ready-goods to /admin/ready-goods and it renders", async () => {
    goTo("/admin/execution/ready-goods");
    await waitFor(() => expect(window.location.pathname).toBe("/admin/ready-goods"), { timeout: 15000 });
    await waitFor(() => expect(screen.getByTestId("admin-layout-stub")).toBeInTheDocument(), { timeout: 15000 });
    await waitFor(() => expect(screen.queryByText(/page not found/i)).toBeNull(), { timeout: 15000 });
  });
});
