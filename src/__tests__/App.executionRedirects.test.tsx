import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import App from "../App";

// Test-then-implement coverage for the owner's execution-board disposition:
// /admin/execution/production, /admin/execution/assembly and
// /admin/execution/ready-goods all used to read `operational_queue_items`,
// a table with zero writers anywhere in oasis-supabase-core's migration
// history. These three now redirect to the real governed surfaces.

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
      // RoleProtectedRoute forces a logout on any server/client role mismatch.
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

async function verifyRedirect(sourcePath: string, expectedPath: string) {
  goTo(sourcePath);
  await waitFor(() => expect(window.location.pathname).toBe(expectedPath), { timeout: 15000 });
  if (expectedPath.startsWith("/admin/")) {
    await waitFor(() => expect(screen.getByTestId("admin-layout-stub")).toBeInTheDocument(), { timeout: 15000 });
  }
  await waitFor(() => expect(screen.queryByText(/page not found/i)).toBeNull(), { timeout: 15000 });
}

describe("Execution board redirects (dead operational_queue_items surfaces)", () => {
  it("redirects production execution to the governed Operations Controller", async () => {
    await verifyRedirect("/admin/execution/production", "/operations-controller");
  });

  it("redirects assembly execution to governed Assembly Tasks", async () => {
    await verifyRedirect("/admin/execution/assembly", "/admin/assembly-tasks");
  });

  it("redirects ready-goods execution to governed Ready Goods", async () => {
    await verifyRedirect("/admin/execution/ready-goods", "/admin/ready-goods");
  });
});
