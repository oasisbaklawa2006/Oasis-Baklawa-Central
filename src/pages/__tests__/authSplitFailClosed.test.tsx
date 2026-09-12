import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import StaffLogin from "@/pages/StaffLogin";
import BuyerLogin from "@/pages/BuyerLogin";

// AUTH SPLIT — FAIL-CLOSED FOLLOW-UP.
//
// Finding 1: the unresolved-account redirect to /buyer/access-request is a
// governed buyer-onboarding convenience. It must never fire on the staff
// surface -- an unresolved/pending staff identity has to fail closed instead.
//
// Finding 2: the manual_auth / magic-link session-restore path calls
// supabase.auth.setSession() *before* membership/account resolution runs. If
// resolution then fails for a reason other than the intentionally preserved
// buyer-onboarding redirect, the already-established Supabase session must be
// torn down -- it must never be left as a reusable, wrong-surface session.
//
// These tests drive both pages through their real manual_auth effect (the
// simplest path common to both StaffLogin and BuyerLogin) against a mocked
// completeAuthLogin() dependency chain (supabase client + auth-routing RPCs),
// so the real redirectAfterAuth/assertMembership/getPostLoginRedirectOnError
// logic in auth-flow.ts is exercised end-to-end, not stubbed out.

const state = vi.hoisted(() => ({
  sessionUser: { id: "user-1", email: "identity@example.com", phone: null as string | null },
  userRow: null as Record<string, unknown> | null,
  profileRow: null as Record<string, unknown> | null,
  serverRole: null as string | null,
  isInternalStaff: false,
}));

const signOutAndClearSessionMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/utils/authSession", () => ({
  signOutAndClearSession: signOutAndClearSessionMock,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: () => Promise.resolve({ data: { session: { user: state.sessionUser } }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: state.sessionUser }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    rpc: (fn: string) => {
      if (fn === "get_user_role") return Promise.resolve({ data: state.serverRole, error: null });
      if (fn === "is_internal_staff") return Promise.resolve({ data: state.isInternalStaff, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.userRow, error: null }) }),
            ilike: () => ({ limit: () => Promise.resolve({ data: state.userRow ? [state.userRow] : [], error: null }) }),
            or: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.profileRow, error: null }) }) }) };
      }
      if (table === "companies") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
      }
      throw new Error(`unexpected table in test mock: ${table}`);
    },
  },
}));

function goToManualAuth(path: string) {
  window.history.pushState({}, "", `${path}?manual_auth=true#access_token=test-access-token&refresh_token=test-refresh-token`);
}

function renderAt(Component: React.ComponentType, path: string) {
  goToManualAuth(path);
  return render(
    <BrowserRouter>
      <Component />
    </BrowserRouter>,
  );
}

beforeEach(() => {
  signOutAndClearSessionMock.mockClear();
  state.sessionUser = { id: "user-1", email: "identity@example.com", phone: null };
  state.userRow = null;
  state.profileRow = null;
  state.serverRole = null;
  state.isInternalStaff = false;
});

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("Requirement 1 — Staff Login + ACCOUNT_PENDING", () => {
  it("does not navigate to /buyer/access-request and fails closed", async () => {
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: "PENDING", company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: null, is_approved: null, company_id: null, role: null };

    renderAt(StaffLogin, "/staff/login");

    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalled());
    expect(window.location.pathname).toBe("/staff/login");
    expect(window.location.pathname).not.toBe("/buyer/access-request");
  });
});

describe("Requirement 2 — Staff Login + ROLE_NOT_ASSIGNED", () => {
  it("does not navigate to /buyer/access-request and fails closed", async () => {
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: null, company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: null, is_approved: null, company_id: null, role: null };

    renderAt(StaffLogin, "/staff/login");

    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalled());
    expect(window.location.pathname).toBe("/staff/login");
    expect(window.location.pathname).not.toBe("/buyer/access-request");
  });
});

describe("Requirement 3 — Buyer Login + intended ACCOUNT_PENDING onboarding", () => {
  it("preserves the existing governed /buyer/access-request flow and keeps the session", async () => {
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: "PENDING", company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: null, is_approved: null, company_id: null, role: null };

    renderAt(BuyerLogin, "/buyer/login");

    await waitFor(() => expect(window.location.pathname).toBe("/buyer/access-request"));
    expect(signOutAndClearSessionMock).not.toHaveBeenCalled();
  });
});

describe("Requirement 4 — Buyer Login + resolved staff identity", () => {
  it("fails on the buyer membership boundary and clears the authenticated session", async () => {
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: "ADMIN", company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: "approved", is_approved: true, company_id: null, role: "ADMIN" };
    state.serverRole = "ADMIN";

    renderAt(BuyerLogin, "/buyer/login");

    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalled());
    expect(window.location.pathname).toBe("/buyer/login");
    expect(window.location.pathname).not.toBe("/admin/cmd-war-room");
  });
});

describe("Requirement 5 — Staff Login + resolved B2B_BUYER identity", () => {
  it("fails on the staff membership boundary and clears the authenticated session", async () => {
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: "B2B_BUYER", company_id: "company-1",
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: "approved", is_approved: true, company_id: "company-1", role: "B2B_BUYER" };
    state.serverRole = "B2B_BUYER";

    renderAt(StaffLogin, "/staff/login");

    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalled());
    expect(window.location.pathname).toBe("/staff/login");
    expect(window.location.pathname).not.toBe("/buyer");
  });
});

describe("Requirement 6 — a failed post-setSession authorization never leaves a reusable session", () => {
  it("clears the session for every wrong-surface / unresolved outcome, on both surfaces", async () => {
    // Staff surface, unresolved role.
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: null, company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: null, is_approved: null, company_id: null, role: null };
    renderAt(StaffLogin, "/staff/login");
    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalledTimes(1));

    // Buyer surface, resolved staff identity.
    signOutAndClearSessionMock.mockClear();
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: "SUPER_ADMIN", company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: "approved", is_approved: true, company_id: null, role: "SUPER_ADMIN" };
    state.serverRole = "SUPER_ADMIN";
    renderAt(BuyerLogin, "/buyer/login");
    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalledTimes(1));
  });
});
