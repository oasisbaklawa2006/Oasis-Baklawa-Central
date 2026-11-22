import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ResetPassword from "@/pages/ResetPassword";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn(), getClaims: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() } },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function submitPassword() {
  fireEvent.change(screen.getByLabelText("New Password"), {
    target: { value: "wa100-qa-not-a-real-password-123" },
  });
  fireEvent.change(screen.getByLabelText("Confirm Password"), {
    target: { value: "wa100-qa-not-a-real-password-123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: "synthetic-wa100-staff" } }, error: null,
  } as never);
  vi.mocked(supabase.auth.getClaims).mockResolvedValue({
    data: { claims: { session_id: "qa-original-invitation-session", sub: "synthetic-wa100-staff" } },
    error: null,
  } as never);
  vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: {}, error: null } as never);
  vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);
});

afterEach(cleanup);

describe("WA-100 actual password activation and session recovery", () => {
  it("refuses an expired/invalid invite session before updating credentials", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null }, error: null,
    } as never);
    render(<ResetPassword />);
    submitPassword();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("invalid or expired"),
    ));
    expect(supabase.auth.getClaims).not.toHaveBeenCalled();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("fails closed when the invitation session identity cannot be verified", async () => {
    vi.mocked(supabase.auth.getClaims).mockResolvedValueOnce({
      data: { claims: { sub: "synthetic-wa100-staff" } },
      error: null,
    } as never);
    render(<ResetPassword />);
    submitPassword();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("session could not be verified"),
    ));
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it("never signs out when the password update was rejected", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
      data: null, error: { message: "Synthetic Auth rejection" },
    } as never);
    render(<ResetPassword />);
    submitPassword();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("couldn't update your password"),
    ));
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("retries local sign-out after password-save success without ever changing the password twice", async () => {
    vi.mocked(supabase.auth.signOut)
      .mockResolvedValueOnce({ error: { message: "Synthetic sign-out error" } } as never)
      .mockResolvedValueOnce({ error: null } as never);

    render(<ResetPassword />);
    submitPassword();
    const retry = await screen.findByRole("button", { name: "Retry sign out" });
    expect(screen.getByText(/Your password was saved, but sign-out has not completed/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(2));
    await screen.findByText("Password Updated");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      "/staff/login", { replace: true },
    ), { timeout: 2500 });
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(3);
  });

  it("does not sign out a newly replaced session when a retry is clicked", async () => {
    const originalClaims = {
      data: { claims: { session_id: "qa-original-invitation-session", sub: "synthetic-wa100-staff" } },
      error: null,
    };
    const replacementClaims = {
      data: { claims: { session_id: "qa-newer-unrelated-session", sub: "synthetic-wa100-staff" } },
      error: null,
    };
    vi.mocked(supabase.auth.getClaims)
      .mockResolvedValueOnce(originalClaims as never)
      .mockResolvedValueOnce(originalClaims as never)
      .mockResolvedValueOnce(replacementClaims as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
      error: { message: "Synthetic initial sign-out failure" },
    } as never);

    render(<ResetPassword />);
    submitPassword();
    const retry = await screen.findByRole("button", { name: "Retry sign out" });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    expect(await screen.findByText(/A different login session is now active/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry sign out" })).not.toBeInTheDocument();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not sign out when retry cannot verify the original session", async () => {
    const originalClaims = {
      data: { claims: { session_id: "qa-original-invitation-session", sub: "synthetic-wa100-staff" } },
      error: null,
    };
    vi.mocked(supabase.auth.getClaims)
      .mockResolvedValueOnce(originalClaims as never)
      .mockResolvedValueOnce(originalClaims as never)
      .mockResolvedValueOnce({ data: null, error: { message: "Transient verification failure" } } as never)
      .mockResolvedValueOnce(originalClaims as never);
    vi.mocked(supabase.auth.signOut)
      .mockResolvedValueOnce({ error: { message: "Initial sign-out blocked" } } as never)
      .mockResolvedValueOnce({ error: null } as never);

    render(<ResetPassword />);
    submitPassword();
    const retry = await screen.findByRole("button", { name: "Retry sign out" });
    fireEvent.click(retry);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("session could not be verified"),
    ));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Retry sign out" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry sign out" }));
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(2));
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it("completes the staff-login return when the original session is already signed out, without a second password update", async () => {
    const originalClaims = {
      data: { claims: { session_id: "qa-original-invitation-session", sub: "synthetic-wa100-staff" } },
      error: null,
    };
    vi.mocked(supabase.auth.getClaims)
      .mockResolvedValueOnce(originalClaims as never)
      .mockResolvedValueOnce(originalClaims as never)
      // Confirmed absence: auth-js yields data=null and error=null when no session exists.
      .mockResolvedValueOnce({ data: null, error: null } as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
      error: { message: "Synthetic initial sign-out failure" },
    } as never);

    render(<ResetPassword />);
    submitPassword();
    const retry = await screen.findByRole("button", { name: "Retry sign out" });
    fireEvent.click(retry);
    await screen.findByText("Password Updated");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      "/staff/login", { replace: true },
    ), { timeout: 2500 });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it("goes to staff login only after successful sign-out", async () => {
    render(<ResetPassword />);
    submitPassword();
    await screen.findByText("Password Updated");
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(
      "/staff/login", { replace: true },
    ), { timeout: 2500 });
  });
});
