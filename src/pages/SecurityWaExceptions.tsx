import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/roleNormalization";
import { MfaError, proveSession, type Aal2Proof } from "@/lib/auth/mfaTotp";
import {
  CLOSURE_ITEMS,
  closeException,
  ledgerToText,
  revalidate,
  type ClosureItem,
  type ExceptionState,
  type LedgerEntry,
} from "@/lib/wa-governance/waExceptionClosure";

/**
 * SUPER_ADMIN-only page (route: /security/wa-exceptions) for the governed closure of exactly five validated
 * WhatsApp reconciliation exceptions. It calls the existing whatsapp_resolve_reconciliation_exception RPC with the
 * operator's own AAL2 session, one record at a time, after an explicit confirmation. It writes nothing else.
 */

type Session = { kind: "loading" } | { kind: "expired" } | { kind: "ready"; proof: Aal2Proof };

const short = (id: string) => id.slice(0, 8);

export default function SecurityWaExceptions() {
  const { role, user } = useAuth();
  const allowed = normalizeRole(role) === "SUPER_ADMIN";
  const [session, setSession] = useState<Session>({ kind: "loading" });
  const [states, setStates] = useState<Record<string, ExceptionState>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    let proof: Aal2Proof;
    try {
      proof = await proveSession(supabase);
    } catch (e) {
      if (e instanceof MfaError && e.failure === "session_expired") return setSession({ kind: "expired" });
      return setSession({
        kind: "ready",
        proof: { jwtAal: null, currentLevel: null, stepUpAccepted: false, canCloseWhatsapp: false, readFailed: true, ok: false },
      });
    }
    setSession({ kind: "ready", proof });
    const entries = await Promise.all(CLOSURE_ITEMS.map(async (item) => [item.exceptionId, await revalidate(supabase, item)] as const));
    setStates(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 p-4">
        <Alert variant="destructive">
          <AlertTitle>Not available</AlertTitle>
          <AlertDescription>This page is limited to authorised super-admin accounts.</AlertDescription>
        </Alert>
      </main>
    );
  }

  const confirmClose = async (item: ClosureItem) => {
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await closeException(supabase, item);
      setLedger((prev) => [...prev, ...outcome.ledger]);
      setMessage(
        outcome.ok
          ? `Closed and verified: ${short(item.exceptionId)}.`
          : `Not closed (${outcome.reason ?? "unknown"}): ${short(item.exceptionId)}. Nothing else was changed.`,
      );
    } finally {
      setConfirming(null);
      setBusy(false);
    }
    const [proof, fresh] = await Promise.all([proveSession(supabase).catch(() => null), revalidate(supabase, item)]);
    if (proof) setSession({ kind: "ready", proof });
    setStates((prev) => ({ ...prev, [item.exceptionId]: fresh }));
  };

  const copyLedger = async () => {
    try {
      await navigator.clipboard.writeText(ledgerToText(ledger));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const proof = session.kind === "ready" ? session.proof : null;
  const canAct = Boolean(proof?.ok);
  const unlocked = CLOSURE_ITEMS.filter((i) => states[i.exceptionId]?.status === "RESOLVED").length;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-xl font-semibold">Close WhatsApp exceptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Five validated PACKET_WITHOUT_CASE exceptions. Closing records you as the operator; nothing is deleted.
        </p>
      </header>

      {session.kind === "loading" ? <p role="status">Checking your session…</p> : null}

      {session.kind === "expired" ? (
        <div className="flex flex-col gap-3" data-testid="wa-session-expired">
          <p className="text-sm">Your session has expired. Sign in again, then return to this page.</p>
          <Button asChild size="lg" className="h-12 w-full text-base">
            <Link to="/staff/login">Sign in</Link>
          </Button>
        </div>
      ) : null}

      {proof && !proof.ok ? (
        <Alert variant="destructive" data-testid="wa-not-aal2">
          <AlertTitle>{proof.readFailed ? "Session checks could not be read" : "Closing is locked"}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              {proof.readFailed
                ? "Some checks failed to load, so closing stays locked. Refresh to try again."
                : "Closing needs an AAL2 session with the database step-up and the wa.intake.close permission. Verify your authenticator first."}
            </span>
            <span className="text-xs">
              Token level: {proof.jwtAal ?? "unknown"} · Auth level: {proof.currentLevel ?? "unknown"} · Step-up:{" "}
              {proof.stepUpAccepted ? "yes" : proof.readFailed ? "unknown" : "no"} · wa.intake.close:{" "}
              {proof.canCloseWhatsapp ? "yes" : proof.readFailed ? "unknown" : "no"}
            </span>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="h-11 flex-1">
                <Link to="/security/mfa">Verify authenticator</Link>
              </Button>
              <Button variant="outline" className="h-11 flex-1" onClick={() => void load()}>
                Refresh
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {proof?.ok ? (
        <Alert data-testid="wa-aal2-ok">
          <AlertDescription>AAL2 verified with wa.intake.close. {unlocked} of 5 closed.</AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert data-testid="wa-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {session.kind === "ready"
        ? CLOSURE_ITEMS.map((item) => {
            const state = states[item.exceptionId];
            return (
              <section key={item.exceptionId} className="flex flex-col gap-2 rounded-md border p-3" data-testid={`wa-item-${short(item.exceptionId)}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm">{short(item.exceptionId)}</p>
                  {state?.status === "RESOLVED" ? <Badge>Closed</Badge> : state?.status === "OPEN" ? <Badge variant="outline">Open</Badge> : <Badge variant="destructive">{state ? "Unreadable" : "Checking"}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Packet {short(item.packetId)} · run {short(item.runId)}
                  {item.siblingPacketId ? ` · sibling ${short(item.siblingPacketId)}` : ""}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs">
                  {item.investigated.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="rounded bg-muted p-2 text-xs" data-testid="wa-resolution">
                  <span className="font-medium">Resolution to record:</span> {item.resolution}
                </p>

                {state?.status === "OPEN" ? (
                  <ul className="space-y-1 text-xs" data-testid="wa-checks">
                    {state.checks.map((c) => (
                      <li key={c.label}>
                        {c.pass ? "PASS" : "FAIL"} · {c.label}
                        {c.detail ? ` (${c.detail})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {state?.status === "RESOLVED" ? (
                  <p className="text-xs" data-testid="wa-resolved-info">
                    Closed {state.resolvedAt ?? ""} by {state.resolvedBy ? short(state.resolvedBy) : "unknown"}
                    {state.resolvedBy && user?.id && state.resolvedBy === user.id ? " (you)" : ""}.{" "}
                    {state.resolutionMatches ? "Resolution text matches." : "Resolution text differs from the proposed text."}
                  </p>
                ) : null}

                {state?.status === "UNREADABLE" ? <p className="text-xs text-destructive">Could not read this exception ({state.reason}). Closing is refused.</p> : null}

                {state?.status === "OPEN" && confirming !== item.exceptionId ? (
                  <Button
                    className="h-11 w-full"
                    disabled={busy || !canAct || !state.closable}
                    onClick={() => setConfirming(item.exceptionId)}
                  >
                    Review and close
                  </Button>
                ) : null}

                {state?.status === "OPEN" && confirming === item.exceptionId ? (
                  <div className="flex flex-col gap-2 rounded-md border border-primary p-2" data-testid="wa-confirm">
                    <p className="text-sm">
                      Close exception <strong>{short(item.exceptionId)}</strong> (packet {short(item.packetId)}) with the resolution above? This records you as
                      the closing operator and cannot be undone here.
                    </p>
                    <Button className="h-11 w-full" disabled={busy} onClick={() => void confirmClose(item)}>
                      {busy ? "Closing…" : "Confirm: close this exception"}
                    </Button>
                    <Button variant="outline" className="h-11 w-full" disabled={busy} onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </section>
            );
          })
        : null}

      <section className="flex flex-col gap-2" data-testid="wa-ledger">
        <h2 className="text-base font-medium">Audit ledger (this session)</h2>
        {ledger.length === 0 ? (
          <p className="text-xs text-muted-foreground">No actions yet. The database also keeps resolved_by, resolved_at and the resolution text on each record.</p>
        ) : (
          <>
            <ul className="space-y-1 text-xs">
              {ledger.map((e, i) => (
                <li key={`${e.at}-${i}`} className="break-words">
                  {e.at} · {short(e.exceptionId)} · {e.step} · {e.detail}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="h-11 w-full" onClick={() => void copyLedger()}>
              {copied ? "Copied" : "Copy ledger"}
            </Button>
          </>
        )}
      </section>

      <Button asChild variant="outline" size="lg" className="h-12 w-full text-base">
        <Link to="/admin">Back to Central</Link>
      </Button>
    </main>
  );
}
