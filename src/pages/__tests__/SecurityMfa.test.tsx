import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SecurityMfa from "@/pages/SecurityMfa";
import { discardHeldEnrolment } from "@/lib/auth/mfaTotp";

const SECRET = "JBSWY3DPEHPK3PXP";
const URI = `otpauth://totp/Oasis:admin?secret=${SECRET}&issuer=Oasis`;
const SECRET_2 = "KRSXG5CTMVRXEZLU";
const SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 4'><path d='M0 0h4v4H0z' fill='#000'/></svg>";

const jwt = (aal: string) => `h.${btoa(JSON.stringify({ aal })).replace(/=+$/, "")}.s`;

const h = vi.hoisted(() => ({
  role: "SUPER_ADMIN" as string | null,
  session: true,
  level: "aal1" as "aal1" | "aal2",
  verified: [] as Array<{ id: string; status: string; friendly_name?: string }>,
  verifyError: null as null | Record<string, unknown>,
  canClose: true,
  failAal: false,
  failAalAfterVerify: false,
  failRpc: false,
  verifyCalls: 0,
  enrollCalls: 0,
  unenrollCalls: 0,
  unverified: [] as Array<{ id: string; status: string; friendly_name?: string }>,
  verifyErrorOnce: null as null | Record<string, unknown>,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: h.role, user: { id: "u1" } }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session ? { access_token: jwt(h.level) } : null }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () =>
          h.failAal
            ? { data: null, error: { name: "AuthRetryableFetchError", status: 500, message: "network" } }
            : {
                data: { currentLevel: h.level, nextLevel: h.verified.some((f) => f.status === "verified") ? "aal2" : "aal1" },
                error: null,
              },
        listFactors: async () => ({
          data: { all: [...h.verified, ...h.unverified].map((f) => ({ ...f, factor_type: "totp" })), totp: h.verified },
          error: null,
        }),
        unenroll: async ({ factorId }: { factorId: string }) => {
          h.unenrollCalls += 1;
          h.unverified = h.unverified.filter((f) => f.id !== factorId);
          h.verified = h.verified.filter((f) => f.id !== factorId);
          return { error: null };
        },
        enroll: async () => {
          h.enrollCalls += 1;
          const id = `f-${h.enrollCalls}`;
          h.unverified.push({ id, status: "unverified", friendly_name: `oasis-central-${h.enrollCalls}` });
          // supabase-js 2.x already returns the QR as a data URI whose payload is the raw SVG.
          return {
            data: {
              id,
              totp: {
                qr_code: `data:image/svg+xml;utf-8,${SVG}`,
                secret: h.enrollCalls === 1 ? SECRET : SECRET_2,
                uri: URI,
              },
            },
            error: null,
          };
        },
        challenge: async ({ factorId }: { factorId: string }) => ({ data: { id: `c-${factorId}` }, error: null }),
        verify: async ({ factorId }: { factorId: string }) => {
          h.verifyCalls += 1;
          if (h.verifyErrorOnce) {
            const err = h.verifyErrorOnce;
            h.verifyErrorOnce = null;
            return { data: null, error: err };
          }
          if (h.verifyError) return { data: null, error: h.verifyError };
          h.level = "aal2";
          const done = h.unverified.find((f) => f.id === factorId);
          h.unverified = h.unverified.filter((f) => f.id !== factorId);
          h.verified = [...h.verified, { id: factorId, status: "verified", friendly_name: done?.friendly_name ?? "oasis-central" }];
          if (h.failAalAfterVerify) h.failAal = true;
          return { data: {}, error: null };
        },
      },
    },
    rpc: async (name: string) => h.failRpc ? { data: null, error: { message: "network" } } : (name === "has_step_up_auth" ? { data: h.level === "aal2" } : { data: h.level === "aal2" && h.canClose }),
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
  Object.assign(h, { role: "SUPER_ADMIN", session: true, level: "aal1", verified: [], verifyError: null, canClose: true, failAal: false, failAalAfterVerify: false, failRpc: false, verifyCalls: 0, enrollCalls: 0, unenrollCalls: 0, unverified: [], verifyErrorOnce: null });
  discardHeldEnrolment();
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

  it("a failed status read at load shows Try again, never the 'set up authenticator' screen", async () => {
    h.failAal = true;
    renderPage();
    expect(await screen.findByTestId("mfa-load-error")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set up authenticator/i })).not.toBeInTheDocument();
    h.failAal = false;
    h.level = "aal2";
    h.verified = [{ id: "f1", status: "verified", friendly_name: "phone" }];
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect((await screen.findByTestId("mfa-proof")).textContent).toMatch(/Verified: protected actions unlocked/);
  });

  it("after a successful verify, a failed read-back never returns to code entry and offers Refresh status", async () => {
    h.failAalAfterVerify = true;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));
    await screen.findByRole("link", { name: /open authenticator/i });
    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    const panel = await screen.findByTestId("mfa-load-error");
    expect(panel.textContent).toMatch(/activated, but the status check could not finish/i);
    expect(panel.textContent).not.toMatch(/nothing was changed/i);
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();
    expect(h.verifyCalls).toBe(1);
    h.failAal = false;
    fireEvent.click(screen.getByRole("button", { name: /refresh status/i }));
    expect((await screen.findByTestId("mfa-proof")).textContent).toMatch(/Verified: protected actions unlocked/);
    expect(h.verifyCalls).toBe(1);
    expect(consoleText()).not.toContain(SECRET);
  });

  it("shows UNKNOWN, not FAIL, for database verdicts whose read failed", async () => {
    h.level = "aal2";
    h.verified = [{ id: "f1", status: "verified", friendly_name: "phone" }];
    h.failRpc = true;
    renderPage();
    const panel = await screen.findByTestId("mfa-proof");
    expect(panel.textContent).toMatch(/Database step-up check: UNKNOWN/);
    expect(panel.textContent).toMatch(/wa\.intake\.close\): UNKNOWN/);
    expect(panel.textContent).not.toMatch(/step-up check: FAIL/);
  });

  describe("recorded iPhone sequence (owner screen recording)", () => {
    const openPending = async () => {
      fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));
      await screen.findByRole("link", { name: /open authenticator/i });
    };
    const showKey = () => {
      fireEvent.click(screen.getByRole("button", { name: /show setup key/i }));
      return screen.getByTestId("mfa-setup-key").textContent;
    };

    it("app switch that unmounts the page (auth refresh) resumes the SAME factor and key, with no new enrolment", async () => {
      // ProtectedRoute shows a spinner (unmounting the page) while the profile re-bootstraps on return from Passwords.
      const { rerender } = render(
        <MemoryRouter>
          <SecurityMfa />
        </MemoryRouter>,
      );
      await openPending();
      expect(showKey()).toBe("JBSW Y3DP EHPK 3PXP");
      expect(h.enrollCalls).toBe(1);

      rerender(<MemoryRouter><div role="status">Verifying session profile</div></MemoryRouter>);
      rerender(<MemoryRouter><SecurityMfa /></MemoryRouter>);

      expect(await screen.findByTestId("mfa-pending")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /set up authenticator/i })).not.toBeInTheDocument();
      expect(showKey()).toBe("JBSW Y3DP EHPK 3PXP");
      expect(h.enrollCalls).toBe(1);
      expect(h.unenrollCalls).toBe(0);

      // the code generated from the original authenticator entry now verifies against the same factor
      typeCode("123456");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      expect((await screen.findByTestId("mfa-proof")).textContent).toMatch(/Verified: protected actions unlocked/);
      expect(h.enrollCalls).toBe(1);
      expect(h.verifyCalls).toBe(1);
    });

    it("a rejected code keeps the same factor and key (no silent replacement) and explains the entry rule", async () => {
      renderPage();
      await openPending();
      h.verifyErrorOnce = { name: "AuthApiError", status: 422, code: "mfa_verification_failed", message: "x" };
      typeCode("000000");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      expect((await screen.findByTestId("mfa-error")).textContent).toMatch(/not accepted/i);
      expect(screen.getByTestId("mfa-pending").textContent).toMatch(/only one that will work/i);
      expect(h.enrollCalls).toBe(1);
      expect(h.unenrollCalls).toBe(0);
      typeCode("123456");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      expect(await screen.findByTestId("mfa-proof")).toBeInTheDocument();
      expect(h.enrollCalls).toBe(1);
    });

    it("double-tapping Set up creates one factor only", async () => {
      renderPage();
      const button = await screen.findByRole("button", { name: /set up authenticator/i });
      fireEvent.click(button);
      fireEvent.click(button);
      await screen.findByRole("link", { name: /open authenticator/i });
      expect(h.enrollCalls).toBe(1);
    });

    it("after a full reload the old key is gone: nothing is deleted silently, the owner is told to replace the entry, and discarding is explicit", async () => {
      const first = renderPage();
      await openPending();
      first.unmount();
      discardHeldEnrolment(); // full page reload: in-memory secret is lost, the unverified factor remains on the server

      renderPage();
      const panel = await screen.findByTestId("mfa-unfinished");
      expect(panel.textContent).toMatch(/delete the\s+earlier entry in your authenticator/i);
      expect(screen.queryByRole("button", { name: /^set up authenticator$/i })).not.toBeInTheDocument();
      expect(h.unenrollCalls).toBe(0);
      expect(h.enrollCalls).toBe(1);

      fireEvent.click(screen.getByRole("button", { name: /discard earlier setup and start again/i }));
      await screen.findByTestId("mfa-pending");
      expect(h.unenrollCalls).toBe(1);
      expect(h.enrollCalls).toBe(2);
      expect(showKey()).toBe("KRSX G5CT MVRX EZLU");
      expect(h.unverified).toHaveLength(1);

      typeCode("123456");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      expect(await screen.findByTestId("mfa-proof")).toBeInTheDocument();
    });

    it("a factor that no longer exists is reported as needing a replacement entry, and is never retried silently", async () => {
      renderPage();
      await openPending();
      h.unverified = [];
      h.verifyErrorOnce = { name: "AuthApiError", status: 404, code: "mfa_factor_not_found", message: "x" };
      typeCode("123456");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      expect((await screen.findByTestId("mfa-error")).textContent).toMatch(/no longer exists/i);
      expect(await screen.findByRole("button", { name: /set up authenticator/i })).toBeInTheDocument();
      expect(h.enrollCalls).toBe(1);
    });

    it("an expired challenge is explained and the same factor stays usable", async () => {
      renderPage();
      await openPending();
      h.verifyErrorOnce = { name: "AuthApiError", status: 422, code: "mfa_challenge_expired", message: "x" };
      typeCode("123456");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      expect((await screen.findByTestId("mfa-error")).textContent).toMatch(/took too long/i);
      expect(h.enrollCalls).toBe(1);
      expect(screen.getByTestId("mfa-pending")).toBeInTheDocument();
    });

    it("renders the Supabase QR (data URI payload) as a single well-formed image, and falls back if it cannot load", async () => {
      renderPage();
      await openPending();
      const img = screen.getByAltText(/authenticator qr code/i) as HTMLImageElement;
      const src = img.getAttribute("src") ?? "";
      expect(src.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
      expect(src).not.toMatch(/data%3A/i);
      expect(decodeURIComponent(src.split(",")[1])).toBe(SVG);

      fireEvent.error(img);
      expect(await screen.findByTestId("mfa-qr-failed")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /open authenticator/i })).toBeInTheDocument();
    });

    it("never writes the secret or the QR to console or browser storage across the whole recorded sequence", async () => {
      const { rerender } = render(<MemoryRouter><SecurityMfa /></MemoryRouter>);
      await openPending();
      showKey();
      rerender(<MemoryRouter><div /></MemoryRouter>);
      rerender(<MemoryRouter><SecurityMfa /></MemoryRouter>);
      await screen.findByTestId("mfa-pending");
      expect(consoleText()).not.toContain(SECRET);
      expect(storageText()).not.toContain(SECRET);
      expect(storageText()).not.toContain("svg");
    });
  
    it("verified factor + leftover unverified factor: Add another explains and offers an explicit discard (no dead end)", async () => {
      h.level = "aal2";
      h.verified = [{ id: "v1", status: "verified", friendly_name: "phone" }];
      h.unverified = [{ id: "stale", status: "unverified", friendly_name: "oasis-central-old" }];
      renderPage();
      await screen.findByTestId("mfa-proof");
      fireEvent.click(screen.getByText(/backup, replacement and recovery/i));
      fireEvent.click(screen.getByRole("button", { name: /add another authenticator/i }));
      expect((await screen.findByTestId("mfa-error")).textContent).toMatch(/never finished/i);
      expect(h.unenrollCalls).toBe(0);
      expect(h.enrollCalls).toBe(0);

      fireEvent.click(screen.getByRole("button", { name: /discard earlier unfinished setup and start again/i }));
      await screen.findByTestId("mfa-pending");
      expect(h.unenrollCalls).toBe(1);
      expect(h.enrollCalls).toBe(1);
      expect(h.verified).toHaveLength(1);
    });
  
    it("aal1 account with a verified factor AND a held pending key can still unlock with the verified factor", async () => {
      renderPage();
      // enrol a first factor to aal2, then start a second setup and hold its key
      await openPending();
      typeCode("123456");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      await screen.findByTestId("mfa-proof");
      fireEvent.click(screen.getByText(/backup, replacement and recovery/i));
      fireEvent.click(screen.getByRole("button", { name: /add another authenticator/i }));
      await screen.findByTestId("mfa-pending");
      expect(h.enrollCalls).toBe(2);

      // a fresh sign-in drops the session to aal1 while the page remounts
      h.level = "aal1";
      cleanup();
      renderPage();
      expect(await screen.findByText(/enter the current code from your authenticator app/i)).toBeInTheDocument();
      expect(screen.queryByTestId("mfa-pending")).not.toBeInTheDocument();
      typeCode("123456");
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      await screen.findByTestId("mfa-proof");

      // the held key is offered again, unchanged and without a third enrol
      fireEvent.click(screen.getByText(/backup, replacement and recovery/i));
      fireEvent.click(screen.getByRole("button", { name: /add another authenticator/i }));
      await screen.findByTestId("mfa-pending");
      expect(h.enrollCalls).toBe(2);
    });
  });
});

