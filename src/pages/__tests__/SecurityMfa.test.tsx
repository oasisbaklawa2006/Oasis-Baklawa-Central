import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SecurityMfa from "@/pages/SecurityMfa";

const SECRET = "JBSWY3DPEHPK3PXP";
const URI = `otpauth://totp/Oasis:admin?secret=${SECRET}&issuer=Oasis`;

const jwt = (aal: string) => `h.${btoa(JSON.stringify({ aal })).replace(/=+$/, "")}.s`;

const h = vi.hoisted(() => ({
  role: "SUPER_ADMIN" as string | null,
  session: true,
  level: "aal1" as "aal1" | "aal2",
  verified: [] as Array<{ id: string; status: string; friendly_name?: string }>,
  verifyError: null as null | Record<string, unknown>,
  canClose: true,
  verifyCalls: 0,
  enrollCalls: 0,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: h.role, user: { id: "u1" } }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session ? { access_token: jwt(h.level) } : null }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: h.level, nextLevel: h.verified.some((f) => f.status === "verified") ? "aal2" : "aal1" },
          error: null,
        }),
        listFactors: async () => ({ data: { all: h.verified.map((f) => ({ ...f, factor_type: "totp" })), totp: h.verified }, error: null }),
        unenroll: async () => ({ error: null }),
        enroll: async () => {
          h.enrollCalls += 1;
          return { data: { id: "f-new", totp: { qr_code: "<svg xmlns='http://www.w3.org/2000/svg'/>", secret: SECRET, uri: URI } }, error: null };
        },
        challenge: async () => ({ data: { id: "c1" }, error: null }),
        verify: async () => {
          h.verifyCalls += 1;
          if (h.verifyError) return { data: null, error: h.verifyError };
          h.level = "aal2";
          h.verified = [{ id: "f-new", status: "verified", friendly_name: "oasis-central" }];
          return { data: {}, error: null };
        },
      },
    },
    rpc: async (name: string) => (name === "has_step_up_auth" ? { data: h.level === "aal2" } : { data: h.level === "aal2" && h.canClose }),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SecurityMfa />
    </MemoryRouter>,
  );
}

const typeCode = (value: string) => fireEvent.change(screen.getByLabelText(/code/i), { target: { value } });

let spies: Array<ReturnType<typeof vi.spyOn>>;
beforeEach(() => {
  Object.assign(h, { role: "SUPER_ADMIN", session: true, level: "aal1", verified: [], verifyError: null, canClose: true, verifyCalls: 0, enrollCalls: 0 });
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => spies.forEach((s) => s.mockRestore()));

const consoleText = () => spies.flatMap((s) => s.mock.calls).flat().map((a) => String(a)).join("\n");
const storageText = () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });

describe("SecurityMfa page", () => {
  it("is unavailable to non-super-admin roles and never calls the MFA API", async () => {
    h.role = "SALES_EXECUTIVE";
    renderPage();
    expect(await screen.findByText(/limited to authorised super-admin/i)).toBeInTheDocument();
    expect(h.enrollCalls).toBe(0);
  });

  it("sends an expired/absent session to sign-in", async () => {
    h.session = false;
    renderPage();
    expect(await screen.findByTestId("mfa-session-expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/staff/login");
  });

  it("enrols: setup key is hidden until asked, then verifying reaches AAL2 with all four checks passing", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));
    expect(await screen.findByRole("link", { name: /open authenticator/i })).toHaveAttribute("href", URI);
    expect(screen.queryByTestId("mfa-setup-key")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET);

    fireEvent.click(screen.getByRole("button", { name: /show setup key/i }));
    expect(screen.getByTestId("mfa-setup-key").textContent).toBe("JBSW Y3DP EHPK 3PXP");

    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    const proof = await screen.findByTestId("mfa-proof");
    expect(proof.textContent).toMatch(/Verified: protected actions unlocked/);
    expect(proof.textContent).toMatch(/token\): PASS/);
    expect(proof.textContent).toMatch(/Auth\): PASS/);
    expect(proof.textContent).toMatch(/Database step-up check: PASS/);
    expect(proof.textContent).toMatch(/wa\.intake\.close\): PASS/);
    // the secret is gone from the page once enrolment completes
    expect(document.body.textContent).not.toContain(SECRET);
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it("never writes the secret to the console or to browser storage during the whole flow", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));
    fireEvent.click(await screen.findByRole("button", { name: /show setup key/i }));
    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await screen.findByTestId("mfa-proof");
    expect(consoleText()).not.toContain(SECRET);
    expect(consoleText()).not.toContain("otpauth");
    expect(storageText()).not.toContain(SECRET);
    expect(storageText()).not.toContain("otpauth");
  });

  it("rejects an invalid code with a plain message, clears the input and does not reach AAL2", async () => {
    h.verifyError = { name: "AuthApiError", status: 422, code: "mfa_verification_failed", message: "Invalid TOTP code entered" };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));
    await screen.findByRole("link", { name: /open authenticator/i });
    typeCode("000000");
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    expect((await screen.findByTestId("mfa-error")).textContent).toMatch(/not accepted/i);
    expect(screen.queryByTestId("mfa-proof")).not.toBeInTheDocument();
    expect((screen.getByLabelText(/code/i) as HTMLInputElement).value).toBe("");
  });

  it("keeps the verify button disabled until six digits, so no request is sent for a short code", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));
    await screen.findByRole("link", { name: /open authenticator/i });
    typeCode("12345");
    expect(screen.getByRole("button", { name: /^verify$/i })).toBeDisabled();
    expect(h.verifyCalls).toBe(0);
  });

  it("handles a session that expires mid-flow", async () => {
    h.verifyError = { name: "AuthApiError", status: 401, code: "session_expired", message: "JWT expired" };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));
    await screen.findByRole("link", { name: /open authenticator/i });
    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    expect(await screen.findByTestId("mfa-session-expired")).toBeInTheDocument();
  });

  it("existing factor at aal1: asks for a code and steps up; permission failure is reported, not hidden", async () => {
    h.verified = [{ id: "f1", status: "verified", friendly_name: "phone" }];
    h.canClose = false;
    renderPage();
    await screen.findByText(/unlock protected actions/i);
    typeCode("654321");
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    const proof = await screen.findByTestId("mfa-proof");
    expect(proof.textContent).toMatch(/Check incomplete/);
    expect(proof.textContent).toMatch(/Database step-up check: PASS/);
    expect(proof.textContent).toMatch(/wa\.intake\.close\): FAIL/);
    expect(proof.textContent).toMatch(/does not hold the close permission/);
  });

  it("shows recovery guidance and will not offer to remove the only authenticator", async () => {
    h.level = "aal2";
    h.verified = [{ id: "f1", status: "verified", friendly_name: "phone" }];
    renderPage();
    const proof = await screen.findByTestId("mfa-proof");
    expect(proof.textContent).toMatch(/does not issue recovery codes/i);
    expect(proof.textContent).toMatch(/only authenticator cannot be removed/i);
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument());
  });
});
