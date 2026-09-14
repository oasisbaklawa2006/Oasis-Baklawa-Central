import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import StaffLogin from "@/pages/StaffLogin";
import BuyerLogin from "@/pages/BuyerLogin";

// AUTH SPLIT — FAIL-CLOSED FOLLOW-UP.
//
// Staff manual-auth remains fail-closed. BuyerLogin no longer has a magic-link
// path: it preflights eligibility, verifies through MSG91, exchanges the
// server-issued token_hash, then runs the same governed membership boundary.
// These tests keep the wrong-surface/session-teardown assertions while driving
// BuyerLogin through that current production contract.

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
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: () => Promise.resolve({ data: { session: { user: state.sessionUser, access_token: "test-access-token" } }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: state.sessionUser }, error: null }),
      signInWithOtp: () => Promise.resolve({ error: null }),
      verifyOtp: () => Promise.resolve({
        data: { user: state.sessionUser, session: { user: state.sessionUser, access_token: "test-access-token" } },
        error: null,
      }),
      getSession: () => Promise.resolve({
        data: { session: { user: state.sessionUser, access_token: "test-access-token" } },
        error: null,
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
    },
    functions: {
      invoke: (name: string) => {
        if (name === "buyer-login-gateway") {
          return Promise.resolve({
            data: { ok: true, state: "approved", allowOtp: true, message: "Approved Buyer" },
            error: null,
          });
        }
        if (name === "msg91-email-session") {
          return Promise.resolve({
            data: {
              ok: true,
              token_hash: "server-token-hash",
              user_id: state.sessionUser.id,
              verified_email: state.sessionUser.email,
              approved_b2b_pending_claim: false,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    },
    rpc: (fn: string) => {
      if (fn === "get_user_role") return Promise.resolve({ data: state.serverRole, error: null });
      if (fn === "is_internal_staff") return Promise.resolve({ data: state.isInternalStaff, error: null });
      if (fn === "claim_approved_b2b_access_request_v2") {
        return Promise.resolve({
          data: [{ application_id: "app-1", claimed: false, company_id: "company-1", already_active: true }],
          error: null,
        });
      }
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

async function driveBuyerEmailOtp(path: string, email = "identity@example.com", otp = "123456") {
  window.history.pushState({}, "", path);
  render(
    <BrowserRouter>
      <BuyerLogin />
    </BrowserRouter>,
  );

  fireEvent.click(screen.getByText("Email OTP"));
  fireEvent.change(await screen.findByLabelText("Registered email"), { target: { value: email } });
  fireEvent.click(screen.getByText("Continue with email OTP"));

  const otpInput = await screen.findByPlaceholderText("Enter code");
  fireEvent.change(otpInput, { target: { value: otp } });
  fireEvent.click(screen.getByText("Verify and continue"));
}

beforeEach(() => {
  signOutAndClearSessionMock.mockClear();
  state.sessionUser = { id: "user-1", email: "identity@example.com", phone: null };
  state.userRow = null;
  state.profileRow = null;
  state.serverRole = null;
  state.isInternalStaff = false;

  window.initSendOTP = vi.fn();
  window.sendOtp = vi.fn((_identifier, success) => success?.({ reqId: "req-1" }));
  window.verifyOtp = vi.fn((_otp, success) => success?.("provider-access-token"));
  window.retryOtp = vi.fn((_channel, success) => success?.({ reqId: "req-2" }));
  window.isCaptchaVerified = vi.fn(() => true);
});

afterEach(() => {
  window.history.pushState({}, "", "/");
  delete window.initSendOTP;
  delete window.sendOtp;
  delete window.verifyOtp;
  delete window.retryOtp;
  delete window.isCaptchaVerified;
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
  it("preserves the governed /buyer/access-request flow and keeps the session", async () => {
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: "PENDING", company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: null, is_approved: null, company_id: null, role: null };

    await driveBuyerEmailOtp("/buyer/login");

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

    await driveBuyerEmailOtp("/buyer/login");

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

describe("Requirement 6 — a failed post-session authorization never leaves a reusable session", () => {
  it("clears the session for every wrong-surface / unresolved outcome, on both surfaces", async () => {
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: null, company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: null, is_approved: null, company_id: null, role: null };
    renderAt(StaffLogin, "/staff/login");
    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalledTimes(1));

    signOutAndClearSessionMock.mockClear();
    state.userRow = {
      id: "user-1", email: "identity@example.com", role: "SUPER_ADMIN", company_id: null,
      is_active: true, phone: null, mobile_number: null, secondary_phones: null,
    };
    state.profileRow = { status: "approved", is_approved: true, company_id: null, role: "SUPER_ADMIN" };
    state.serverRole = "SUPER_ADMIN";
    await driveBuyerEmailOtp("/buyer/login");
    await waitFor(() => expect(signOutAndClearSessionMock).toHaveBeenCalledTimes(1));
  });
});
