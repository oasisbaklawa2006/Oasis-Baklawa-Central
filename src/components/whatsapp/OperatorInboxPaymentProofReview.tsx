import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchWhatsAppCaseInboundMessages,
  type CaseInboundMessage,
} from "@/lib/wa-governance/caseDecisionDesk";
import { fetchWhatsAppCommercialLayers, type WhatsAppCommercialLayers } from "@/lib/wa-governance/caseCommercialLayers";
import {
  captureWhatsAppPaymentProof,
  newPaymentProofActionKey,
  reviewWhatsAppPaymentProof,
} from "@/lib/wa-governance/paymentProofGovernance";

function value(item: Record<string, unknown>, key: string): string {
  const candidate = item[key];
  return typeof candidate === "string" ? candidate : candidate == null ? "" : String(candidate);
}

function human(input: string): string {
  return input ? input.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "—";
}

export function OperatorInboxPaymentProofReview({
  caseId,
  packetId,
  onReload,
}: {
  caseId: string;
  packetId: string;
  onReload: () => Promise<void>;
}) {
  const [layers, setLayers] = useState<WhatsAppCommercialLayers | null>(null);
  const [messages, setMessages] = useState<CaseInboundMessage[]>([]);
  const [sourceMessageId, setSourceMessageId] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [claimedReference, setClaimedReference] = useState("");
  const [verifiedAmount, setVerifiedAmount] = useState<Record<string, string>>({});
  const [verifiedReference, setVerifiedReference] = useState<Record<string, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [nextLayers, nextMessages] = await Promise.all([
      fetchWhatsAppCommercialLayers(supabase, caseId),
      fetchWhatsAppCaseInboundMessages(supabase, packetId),
    ]);
    setLayers(nextLayers);
    setMessages(nextMessages);
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchWhatsAppCommercialLayers(supabase, caseId),
      fetchWhatsAppCaseInboundMessages(supabase, packetId),
    ]).then(([nextLayers, nextMessages]) => {
      if (!cancelled) {
        setLayers(nextLayers);
        setMessages(nextMessages);
      }
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load payment evidence");
    });
    return () => { cancelled = true; };
  }, [caseId, packetId]);

  const likelyEvidenceMessages = useMemo(
    () => messages.filter((message) => {
      const content = (message.content ?? "").toLowerCase();
      const type = (message.message_type ?? "").toLowerCase();
      return /(payment|utr|transaction|paid|receipt|bank)/.test(content) || ["image", "document"].includes(type);
    }),
    [messages],
  );

  const run = async (name: string, action: () => Promise<unknown>, success: string) => {
    setBusy(name);
    setError(null);
    setFeedback(null);
    try {
      await action();
      await Promise.all([load(), onReload()]);
      setFeedback(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${name} failed`);
    } finally {
      setBusy(null);
    }
  };

  const proofs = layers?.paymentProofs ?? [];
  if (!proofs.length && !likelyEvidenceMessages.length) return null;

  return (
    <details className="mt-2 rounded border border-slate-200 bg-white" data-operator-inbox-interactive>
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-800">Finance evidence · payment proof</summary>
      <div className="border-t border-slate-100 p-3 text-xs">
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-950">
          <ShieldAlert className="mr-1 inline h-3.5 w-3.5" />
          A screenshot, PDF, UTR or customer statement is only evidence received. It is never payment verification until Finance records a VERIFIED decision with AAL2.
        </div>

        {likelyEvidenceMessages.length ? (
          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
            <p className="font-semibold text-slate-800">Capture evidence manually if AI did not classify it</p>
            <select className="mt-2 h-9 w-full rounded border border-input bg-background px-2" value={sourceMessageId} onChange={(event) => setSourceMessageId(event.target.value)}>
              <option value="">Choose inbound evidence</option>
              {likelyEvidenceMessages.map((message) => (
                <option key={message.id} value={message.id}>
                  {message.packet_sequence ?? "?"}. {(message.content ?? `[${message.message_type ?? "media"}]`).slice(0, 100)}
                </option>
              ))}
            </select>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input type="number" min="0" step="0.01" value={claimedAmount} onChange={(event) => setClaimedAmount(event.target.value)} placeholder="Claimed amount (optional)" />
              <Input value={claimedReference} onChange={(event) => setClaimedReference(event.target.value)} placeholder="Claimed UTR/reference (optional)" />
            </div>
            <Button type="button" size="sm" className="mt-2" disabled={busy !== null || !sourceMessageId}
              onClick={() => void run("payment-capture", () => captureWhatsAppPaymentProof(supabase, {
                caseId,
                sourceMessageId,
                claimedAmount: claimedAmount ? Number(claimedAmount) : null,
                claimedReference: claimedReference || null,
                idempotencyKey: newPaymentProofActionKey("capture", caseId),
              }), "Payment evidence captured as RECEIVED; Finance verification is still pending.")}>Capture proof as received</Button>
          </div>
        ) : null}

        {proofs.map((proof) => {
          const proofId = value(proof, "id");
          const status = value(proof, "receipt_status");
          const isFinal = status === "VERIFIED" || status === "REJECTED";
          return (
            <div key={proofId} className="mt-3 rounded border border-slate-200 bg-white p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">Proof {proofId.slice(0, 8)} · {human(status)}</p>
                {status === "VERIFIED" ? <span className="text-emerald-800"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Finance verified</span> : null}
              </div>
              <p className="mt-1 text-slate-600">Claimed amount: {value(proof, "claimed_amount") || "not extracted"}</p>
              <p className="text-slate-600">Claimed reference: {value(proof, "claimed_reference") || "not extracted"}</p>
              {isFinal ? (
                <p className="mt-1 font-medium text-slate-700">
                  {status === "VERIFIED"
                    ? `Verified amount ${value(proof, "verified_amount")} · ${value(proof, "verified_reference")}`
                    : `Rejected · ${value(proof, "rejection_reason")}`}
                </p>
              ) : (
                <>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input type="number" min="0" step="0.01" value={verifiedAmount[proofId] ?? ""} onChange={(event) => setVerifiedAmount((current) => ({ ...current, [proofId]: event.target.value }))} placeholder="Finance verified amount" />
                    <Input value={verifiedReference[proofId] ?? ""} onChange={(event) => setVerifiedReference((current) => ({ ...current, [proofId]: event.target.value }))} placeholder="Bank/Finance verification reference" />
                  </div>
                  <Input className="mt-2" value={rejectionReason[proofId] ?? ""} onChange={(event) => setRejectionReason((current) => ({ ...current, [proofId]: event.target.value }))} placeholder="Rejection reason" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={busy !== null || !verifiedAmount[proofId] || !(verifiedReference[proofId] ?? "").trim()}
                      onClick={() => void run(`payment-verify-${proofId}`, () => reviewWhatsAppPaymentProof(supabase, {
                        paymentProofId: proofId,
                        decision: "VERIFIED",
                        verifiedAmount: Number(verifiedAmount[proofId]),
                        verifiedReference: verifiedReference[proofId],
                        idempotencyKey: newPaymentProofActionKey("verify", caseId),
                      }), "Finance verification recorded. This evidence review did not mutate order-payment truth.")}>Finance verify</Button>
                    <Button type="button" size="sm" variant="destructive" disabled={busy !== null || !(rejectionReason[proofId] ?? "").trim()}
                      onClick={() => void run(`payment-reject-${proofId}`, () => reviewWhatsAppPaymentProof(supabase, {
                        paymentProofId: proofId,
                        decision: "REJECTED",
                        reason: rejectionReason[proofId],
                        idempotencyKey: newPaymentProofActionKey("reject", caseId),
                      }), "Finance rejection recorded with evidence lineage.")}>Reject proof</Button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Both actions are backend-gated to canonical Finance authority + AAL2.</p>
                </>
              )}
            </div>
          );
        })}

        {busy ? <p className="mt-2 text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Applying governed Finance action…</p> : null}
        {feedback ? <p className="mt-2 font-medium text-emerald-800">{feedback}</p> : null}
        {error ? <p className="mt-2 text-amber-900" role="alert">{error}</p> : null}
      </div>
    </details>
  );
}
