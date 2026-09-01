import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";
import {
  buildProductAliasLearningCapture,
  clarificationChipCandidates,
  observedProductPhrase,
} from "@/lib/wa-governance/clarificationProductCandidate";
import {
  captureWhatsAppLearningCandidate,
  fetchWhatsAppCaseDecisionSnapshot,
  newCaseActionIdempotencyKey,
} from "@/lib/wa-governance/caseDecisionDesk";
import type { ProductResolutionCandidate } from "@/lib/wa-governance/productResolutionTypes";

export function ClarificationProductCandidateChips({
  packetId,
  bestMatch,
  alternatives,
  stitchedText,
  orderLineProductName,
}: {
  packetId: string;
  bestMatch: ProductResolutionCandidate | null;
  alternatives: ProductResolutionCandidate[];
  stitchedText?: string;
  orderLineProductName?: string | null;
}) {
  const authority = useWhatsAppPermissions();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captureIdempotencyKeysRef = useRef<Map<string, string>>(new Map());

  const candidates = useMemo(
    () => clarificationChipCandidates(bestMatch, alternatives),
    [alternatives, bestMatch],
  );
  const observedValue = useMemo(
    () => observedProductPhrase({ stitchedText, orderLineProductName }),
    [orderLineProductName, stitchedText],
  );
  const mayCapture = authority.has("wa.intake.triage");
  const activePacketIdRef = useRef(packetId);
  activePacketIdRef.current = packetId;

  useEffect(() => {
    let cancelled = false;
    captureIdempotencyKeysRef.current.clear();
    setError(null);
    setFeedback(null);
    setSelectedProductId(null);
    setLoadingCase(true);
    setCaseId(null);
    void fetchWhatsAppCaseDecisionSnapshot(supabase, packetId)
      .then((snapshot) => {
        if (cancelled) return;
        setError(null);
        setCaseId(snapshot.communicationCase?.id ?? null);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load governed case");
      })
      .finally(() => {
        if (!cancelled) setLoadingCase(false);
      });
    return () => {
      cancelled = true;
    };
  }, [packetId]);

  const captureCandidate = async (candidate: ProductResolutionCandidate) => {
    const requestPacketId = packetId;
    if (!caseId) {
      setError("Governed communication case is not available yet — wait for case materialization or use Decision Desk section 9.");
      return;
    }
    if (!mayCapture) {
      setError("wa.intake.triage permission is required to capture a product clarification candidate.");
      return;
    }
    if (!observedValue) {
      setError("Observed product phrase is missing — review the original evidence before selecting a catalogue match.");
      return;
    }

    const captureKey = `${caseId}:${candidate.productId}`;
    let idempotencyKey = captureIdempotencyKeysRef.current.get(captureKey);
    if (!idempotencyKey) {
      idempotencyKey = newCaseActionIdempotencyKey("learning-product-chip", captureKey);
      captureIdempotencyKeysRef.current.set(captureKey, idempotencyKey);
    }

    setBusyProductId(candidate.productId);
    setError(null);
    setFeedback(null);
    try {
      await captureWhatsAppLearningCandidate(
        supabase,
        buildProductAliasLearningCapture({
          caseId,
          packetId: requestPacketId,
          candidate,
          observedValue,
          idempotencyKey,
        }),
      );
      if (activePacketIdRef.current !== requestPacketId) return;
      setSelectedProductId(candidate.productId);
      setFeedback(`Recorded governed PRODUCT_ALIAS candidate for ${candidate.productName}. Human review is still required before any master-data change.`);
    } catch (caught) {
      if (activePacketIdRef.current !== requestPacketId) return;
      setError(caught instanceof Error ? caught.message : "Could not capture learning candidate");
    } finally {
      if (activePacketIdRef.current === requestPacketId) {
        setBusyProductId(null);
      }
    }
  };

  if (!candidates.length) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Select likely catalogue match</p>
      <p className="mt-1 text-xs text-amber-900/90">
        Tap a candidate to capture a governed PRODUCT_ALIAS learning proposal. This does not invent SKU, price, or quantity and does not promote an order.
      </p>
      {loadingCase ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-amber-900"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading governed case…</p>
      ) : null}
      {!loadingCase && !caseId ? (
        <p className="mt-2 text-xs text-amber-900">No communication case is linked to this packet yet. Chips stay disabled until case materialization completes.</p>
      ) : null}
      {!observedValue ? (
        <p className="mt-2 text-xs text-amber-900">Customer product phrase unavailable — chips stay disabled until original packet evidence is present.</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((candidate) => {
          const selected = selectedProductId === candidate.productId;
          const busy = busyProductId === candidate.productId;
          return (
            <Button
              key={candidate.productId}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              className="h-auto whitespace-normal px-3 py-2 text-left text-xs"
              disabled={busy || !caseId || !mayCapture || authority.loading || !observedValue}
              onClick={() => void captureCandidate(candidate)}
            >
              {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : selected ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : null}
              {candidate.productName}
              <span className="mt-0.5 block font-normal text-[10px] opacity-80">{candidate.confidence}% · {candidate.sku ?? "No SKU"}</span>
            </Button>
          );
        })}
      </div>
      {feedback ? <p className="mt-2 text-xs text-emerald-800">{feedback}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-800" role="alert">{error}</p> : null}
    </div>
  );
}
