import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/roleNormalization";
import {
  MfaError,
  beginEnrolment,
  discardUnfinishedEnrolments,
  formatSetupKey,
  qrImageSrc,
  proveSession,
  readMfaState,
  removeFactor,
  verifyTotpCode,
  type Aal2Proof,
  type MfaFailure,
  type MfaState,
  type PendingEnrolment,
} from "@/lib/auth/mfaTotp";

/**
 * Mobile-first TOTP enrolment / step-up page for SUPER_ADMIN (route: /security/mfa).
 * It only drives the official Supabase Auth MFA API. It never mints or edits claims;
 * AAL2 comes solely from a successful verify, and wa.intake.close is whatever the
 * database says. No secret is logged, persisted or sent to telemetry.
 */

const MESSAGES: Record<MfaFailure, string> = {
  invalid_code: "That code was not accepted. Wait for the next 6-digit code and try again.",
  malformed_code: "Enter the 6 digits shown in your authenticator app.",
  session_expired: "Your session has expired. Sign in again, then return to this page.",
  rate_limited: "Too many attempts. Wait a minute, then try again.",
  mfa_disabled: "Authenticator sign-in is switched off for this project. Ask the owner to enable it in Supabase Auth settings.",
  challenge_expired: "That code took too long. Wait for the next 6-digit code and enter it straight away.",
  factor_missing: "This setup no longer exists, so its key will not work. Start a new setup and replace the old entry in your authenticator.",
  unfinished_setup: "An earlier setup was never finished.",
  unknown: "Something went wrong. Nothing was changed. Try again.",
};

type View =
  | { kind: "loading" }
  | { kind: "session-expired" }
  | { kind: "error"; failure: MfaFailure; activated: boolean }
  | { kind: "enrol"; pending: PendingEnrolment | null }
  | { kind: "unfinished"; count: number }
  | { kind: "verify"; state: MfaState }
  | { kind: "done"; state: MfaState; proof: Aal2Proof };

const failureOf = (error: unknown): MfaFailure => (error instanceof MfaError ? error.failure : "unknown");

export default function SecurityMfa() {
  const { role } = useAuth();
  const allowed = normalizeRole(role) === "SUPER_ADMIN";
  const [view, setView] = useState<View>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MfaFailure | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const state = await readMfaState(supabase);
      if (!state.hasSession) return setView({ kind: "session-expired" });
      // An enrolment in progress always wins: returning from the Passwords app must show the same key again.
      if (state.pending) return setView({ kind: "enrol", pending: state.pending });
      if (state.verified.length === 0) {
        return setView(
          state.unverified.length > 0 ? { kind: "unfinished", count: state.unverified.length } : { kind: "enrol", pending: null },
        );
      }
      if (state.currentLevel === "aal2") {
        return setView({ kind: "done", state, proof: await proveSession(supabase) });
      }
      setView({ kind: "verify", state });
    } catch (e) {
      if (failureOf(e) === "session_expired") return setView({ kind: "session-expired" });
      // A failed read says nothing about enrolment: never fall back to the "set up" screen.
      setView({ kind: "error", failure: failureOf(e), activated: false });
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 p-4">
        <Alert variant="destructive">
          <AlertTitle>Not available</AlertTitle>
          <AlertDescription>Authenticator setup is limited to authorised super-admin accounts.</AlertDescription>
        </Alert>
      </main>
    );
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      const failure = failureOf(e);
      setCode("");
      if (failure === "session_expired") setView({ kind: "session-expired" });
      // Re-read the server truth: shows the "unfinished setup" screen, or a fresh start if the factor is gone.
      if (failure === "unfinished_setup" || failure === "factor_missing") await load();
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const startEnrolment = () =>
    run(async () => {
      const pending = await beginEnrolment(supabase);
      setShowKey(false);
      setCopied(false);
      setQrFailed(false);
      setView({ kind: "enrol", pending });
    });

  const discardAndRestart = () =>
    run(async () => {
      await discardUnfinishedEnrolments(supabase);
      const pending = await beginEnrolment(supabase);
      setShowKey(false);
      setCopied(false);
      setQrFailed(false);
      setView({ kind: "enrol", pending });
    });

  const submitCode = (factorId: string) =>
    run(async () => {
      await verifyTotpCode(supabase, factorId, code);
      // The factor is active from here on. Leave the code-entry views before the read-backs so a
      // failure can never ask the user to verify an already-active factor again.
      setCode("");
      setShowKey(false);
      try {
        const state = await readMfaState(supabase);
        setView({ kind: "done", state, proof: await proveSession(supabase) });
      } catch (e) {
        setView(
          failureOf(e) === "session_expired"
            ? { kind: "session-expired" }
            : { kind: "error", failure: failureOf(e), activated: true },
        );
      }
    });

  const copyKey = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s+/g, ""));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const codeField = (factorId: string, label: string) => (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submitCode(factorId);
      }}
    >
      <label htmlFor="mfa-code" className="text-sm font-medium">{label}</label>
      <Input
        id="mfa-code"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="123456"
        className="h-12 text-center text-2xl tracking-widest"
        disabled={busy}
      />
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Verify"}
      </Button>
    </form>
  );

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-5 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-xl font-semibold">Authenticator security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Required for protected actions such as closing WhatsApp reconciliation exceptions.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive" data-testid="mfa-error">
          <AlertDescription>{MESSAGES[error]}</AlertDescription>
        </Alert>
      ) : null}

      {view.kind === "loading" ? <p role="status">Checking your session…</p> : null}

      {view.kind === "error" ? (
        <div className="flex flex-col gap-3" data-testid="mfa-load-error">
          <Alert variant="destructive">
            <AlertDescription>
              {view.activated
                ? "Your authenticator was activated, but the status check could not finish. Tap Refresh status. Do not enter another code."
                : MESSAGES[view.failure]}
            </AlertDescription>
          </Alert>
          <Button size="lg" className="h-12 w-full text-base" onClick={() => void load()}>
            {view.activated ? "Refresh status" : "Try again"}
          </Button>
        </div>
      ) : null}

      {view.kind === "session-expired" ? (
        <div className="flex flex-col gap-3" data-testid="mfa-session-expired">
          <p className="text-sm">{MESSAGES.session_expired}</p>
          <Button asChild size="lg" className="h-12 w-full text-base">
            <Link to="/staff/login">Sign in</Link>
          </Button>
        </div>
      ) : null}

      {view.kind === "enrol" && !view.pending ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm">
            No authenticator is set up on this account. Use an authenticator app on this phone, or the iPhone built-in
            one: Settings → Passwords → Verification Code → Set Up Verification Code → Enter Setup Key.
          </p>
          <Button size="lg" className="h-12 w-full text-base" onClick={() => void startEnrolment()} disabled={busy}>
            {busy ? "Preparing…" : "Set up authenticator"}
          </Button>
        </section>
      ) : null}

      {view.kind === "unfinished" ? (
        <section className="flex flex-col gap-3" data-testid="mfa-unfinished">
          <Alert>
            <AlertTitle>An earlier setup was never finished</AlertTitle>
            <AlertDescription>
              Its key can only be shown once and can no longer be displayed, so it cannot be completed. First delete the
              earlier entry in your authenticator (iPhone: Settings → Passwords → the Oasis or Central entry → Delete).
              Then tap the button below to make one new key.
            </AlertDescription>
          </Alert>
          <Button size="lg" className="h-12 w-full text-base" onClick={() => void discardAndRestart()} disabled={busy}>
            {busy ? "Preparing…" : "Discard earlier setup and start again"}
          </Button>
        </section>
      ) : null}

      {view.kind === "enrol" && view.pending ? (
        <section className="flex flex-col gap-4" data-testid="mfa-pending">
          <Alert>
            <AlertDescription>
              This key was made at {new Date(view.pending.createdAt).toLocaleTimeString()} and is the only one that will
              work. You can switch to Passwords and back; this page keeps the same key. Do not tap Set up again. If you
              added more than one entry, delete every older one and keep only the newest.
            </AlertDescription>
          </Alert>
          <p className="text-sm">
            On this phone, tap <strong>Open authenticator</strong>, or copy the setup key and paste it into your
            authenticator app. If you are setting up from another screen, scan the QR code instead.
          </p>
          <a
            href={view.pending.uri}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground"
          >
            Open authenticator
          </a>
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide setup key" : "Show setup key"}
            </Button>
            {showKey ? (
              <>
                <p className="select-all break-all font-mono text-lg" data-testid="mfa-setup-key">
                  {formatSetupKey(view.pending.secret)}
                </p>
                <Button type="button" variant="outline" className="h-11 w-full" onClick={() => void copyKey(view.pending!.secret)}>
                  {copied ? "Copied" : "Copy setup key"}
                </Button>
              </>
            ) : null}
          </div>
          {qrFailed ? (
            <p className="text-sm text-muted-foreground" data-testid="mfa-qr-failed">
              The QR code could not be displayed. Use Open authenticator or the setup key instead.
            </p>
          ) : (
            <img
              alt="Authenticator QR code"
              className="mx-auto h-48 w-48 rounded-md border bg-white p-2"
              src={qrImageSrc(view.pending.qrSvg)}
              onError={() => setQrFailed(true)}
            />
          )}
          {codeField(view.pending.factorId, "Then enter the 6-digit code it shows")}
        </section>
      ) : null}

      {view.kind === "verify" ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm">Enter the current code from your authenticator app to unlock protected actions.</p>
          {codeField(view.state.verified[0].id, "6-digit code")}
        </section>
      ) : null}

      {view.kind === "done" ? (
        <section className="flex flex-col gap-4" data-testid="mfa-proof">
          <Alert variant={view.proof.ok ? "default" : "destructive"}>
            <AlertTitle>{view.proof.ok ? "Verified: protected actions unlocked" : "Check incomplete"}</AlertTitle>
            {view.proof.readFailed ? (
              <AlertDescription data-testid="mfa-proof-unknown">
                Some checks could not be read, so their results are unknown, not failed. Tap Refresh to check again.
              </AlertDescription>
            ) : null}
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                <li>Session level (token): {view.proof.jwtAal === "aal2" ? "PASS (aal2)" : `FAIL (${view.proof.jwtAal ?? "unknown"})`}</li>
                <li>Session level (Auth): {view.proof.currentLevel === "aal2" ? "PASS (aal2)" : view.proof.readFailed && view.proof.currentLevel === null ? "UNKNOWN (could not read)" : `FAIL (${view.proof.currentLevel ?? "unknown"})`}</li>
                <li>Database step-up check: {view.proof.stepUpAccepted ? "PASS" : view.proof.readFailed ? "UNKNOWN (could not read)" : "FAIL"}</li>
                <li>WhatsApp close permission (wa.intake.close): {view.proof.canCloseWhatsapp ? "PASS" : view.proof.readFailed ? "UNKNOWN (could not read)" : "FAIL"}</li>
              </ul>
              {!view.proof.readFailed && !view.proof.canCloseWhatsapp && view.proof.stepUpAccepted ? (
                <p className="mt-2 text-sm">This account is verified but does not hold the close permission. Nothing was changed.</p>
              ) : null}
            </AlertDescription>
          </Alert>
          {view.proof.readFailed ? (
            <Button size="lg" className="h-12 w-full text-base" onClick={() => void load()}>Refresh</Button>
          ) : null}
          <Button asChild variant="outline" size="lg" className="h-12 w-full text-base">
            <Link to="/admin">Back to Central</Link>
          </Button>
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Backup, replacement and recovery</summary>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Add a second authenticator on another device now, so one lost phone cannot lock you out.</li>
              <li>To replace this authenticator: add the new one first, confirm it works, then remove the old one.</li>
              <li>Supabase does not issue recovery codes. If every device is lost, the project owner must have a database owner remove the factor, then you set up again.</li>
            </ul>
            <div className="mt-3 flex flex-col gap-2">
              <Button variant="outline" className="h-11 w-full" onClick={() => void startEnrolment()} disabled={busy}>
                Add another authenticator
              </Button>
              {view.state.verified.length > 1
                ? view.state.verified.map((factor) => (
                    <Button
                      key={factor.id}
                      variant="outline"
                      className="h-11 w-full"
                      disabled={busy}
                      onClick={() => void run(async () => { await removeFactor(supabase, factor.id); await load(); })}
                    >
                      Remove {factor.friendlyName ?? "authenticator"}
                    </Button>
                  ))
                : <p className="text-xs text-muted-foreground">The only authenticator cannot be removed here; add a second one first.</p>}
            </div>
          </details>
        </section>
      ) : null}
    </main>
  );
}
