import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";

// AUTH SPLIT — B2B Client Login vs Oasis Staff Login: routing/authorization
// regression coverage. Follows the same render-the-real-App-with-mocked-
// useAuth pattern as App.executionRedirects.test.tsx so these exercise the
// real route tree, RootGate and RoleProtectedRoute rather than a stub.

let mockedAuth: {
  user: { id: string; email?: string | null; phone?: string | null } | null;
  loading: boolean;
  role: string | null;
  companyId: string | null;
  profileReady: boolean;
  hasAppliedB2B: boolean;
  profileStatus: string | null;
};

vi.mock("@/hooks/useAuth", () => ({
  // ProtectedRoute reads isAuthenticated (not user) -- derive it the same
  // way the real AuthProvider does so /admin/* and /buyer/* wrapped routes
  // behave identically to production.
  useAuth: () => ({ ...mockedAuth, isAuthenticated: Boolean(mockedAuth.user) }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AdminLayout.tsx", () => ({
  default: () => <div data-testid="admin-layout-stub" />,
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
      rpc: (fn: string) => Promise.resolve({ data: fn === "get_user_role" ? mockedAuth.role : null, error: null }),
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

describe("Requirement 7 — /buyer/access-request remains reachable pre-login", () => {
  it("renders the public pre-login form for an unauthenticated visitor, no redirect to /login", async () => {
    mockedAuth = {
      user: null,
      loading: false,
      role: null,
      companyId: null,
      profileReady: true,
      hasAppliedB2B: false,
      profileStatus: null,
    };
    goTo("/buyer/access-request");
    await waitFor(() => expect(window.location.pathname).toBe("/buyer/access-request"), { timeout: 15000 });
  });
});

describe("Requirement 10 — a buyer role cannot reach internal admin routes", () => {
  it("bounces a B2B buyer away from /admin to their own buyer destination", async () => {
    mockedAuth = {
      user: { id: "buyer-1", email: "buyer@example.com" },
      loading: false,
      role: "B2B_BUYER",
      companyId: "company-1",
      profileReady: true,
      hasAppliedB2B: true,
      profileStatus: "approved",
    };
    goTo("/admin/cmd-war-room");
    await waitFor(() => expect(window.location.pathname).not.toMatch(/^\/admin/), { timeout: 15000 });
    expect(window.location.pathname).toBe("/buyer");
  });
});

describe("Requirement 11 — a staff role does not automatically receive buyer membership", () => {
  it("bounces an internal ADMIN away from /buyer to their own staff destination", async () => {
    mockedAuth = {
      user: { id: "staff-1", email: "someone@oasisbaklawa.com" },
      loading: false,
      role: "ADMIN",
      companyId: null,
      profileReady: true,
      hasAppliedB2B: false,
      profileStatus: "active",
    };
    goTo("/buyer");
    await waitFor(() => expect(window.location.pathname).not.toBe("/buyer"), { timeout: 15000 });
    expect(window.location.pathname).toBe("/admin/cmd-war-room");
  });
});

describe("Requirement 13 — session restore is role-derived, not identity-derived", () => {
  it("a restored ADMIN session with an email unrelated to any hard-coded identity still reaches the admin destination", async () => {
    mockedAuth = {
      user: { id: "staff-2", email: "another.oasis.employee@oasisbaklawa.com" },
      loading: false,
      role: "ADMIN",
      companyId: null,
      profileReady: true,
      hasAppliedB2B: false,
      profileStatus: "active",
    };
    goTo("/");
    await waitFor(() => expect(window.location.pathname).toBe("/admin/cmd-war-room"), { timeout: 15000 });
    await waitFor(() => expect(screen.getByTestId("admin-layout-stub")).toBeInTheDocument(), { timeout: 15000 });
  });

  it("a restored SUPER_ADMIN session reaches the same destination purely from role", async () => {
    mockedAuth = {
      user: { id: "staff-3", email: "yet.another@oasisbaklawa.com", phone: "+911234567890" },
      loading: false,
      role: "SUPER_ADMIN",
      companyId: null,
      profileReady: true,
      hasAppliedB2B: false,
      profileStatus: "active",
    };
    goTo("/");
    await waitFor(() => expect(window.location.pathname).toBe("/admin/cmd-war-room"), { timeout: 15000 });
  });

  it("a restored unresolved (no role) session lands on the customer-app gate, not /admin", async () => {
    mockedAuth = {
      user: { id: "unresolved-1", email: "unresolved@example.com" },
      loading: false,
      role: null,
      companyId: null,
      profileReady: true,
      hasAppliedB2B: false,
      profileStatus: null,
    };
    goTo("/");
    await waitFor(() => expect(window.location.pathname).toBe("/buyer/access-request"), { timeout: 15000 });
  });
});
