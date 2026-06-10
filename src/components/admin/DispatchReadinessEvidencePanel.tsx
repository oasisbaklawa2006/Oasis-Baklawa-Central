import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, FileText, ScanLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const operationalDb = supabase as unknown as SupabaseClient;
import type { DispatchReadinessBundle } from "@/lib/dispatch-readiness/createDispatchReadinessBundle";
import type { DispatchEvidenceRecord, DispatchReadinessWriteContext } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { DispatchReadinessDimension } from "@/lib/dispatch-readiness/dispatchReadinessTypes";

const DIMENSION_LABELS: Record<DispatchReadinessDimension, string> = {
  queue_ready: "Dispatch queue ready",
  packing_evidence_ready: "Packing photo verified",
  barcode_verified: "Carton barcode verified",
  reservation_ready: "Reservation ready",
  finance_signal_ready: "Finance signal ready",
  gate_scan_ready: "Gate scan verified",
  document_placeholder_ready: "Document placeholder recorded",
  exception_clear: "No open dispatch exceptions",
};

export function DispatchReadinessEvidencePanel({
  orderId,
  bundle,
  writeCtx,
  dimensionResults,
  onRecorded,
  canWrite,
}: {
  orderId: string;
  bundle: DispatchReadinessBundle | null;
  writeCtx: () => DispatchReadinessWriteContext;
  dimensionResults: Record<DispatchReadinessDimension, boolean>;
  onRecorded: () => void;
  canWrite?: boolean;
}) {
  const canRecordEvidence = canWrite ?? bundle?.canExecuteWrites ?? false;
  const [evidence, setEvidence] = useState<DispatchEvidenceRecord[]>([]);
  const [packingRef, setPackingRef] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [gateRef, setGateRef] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState<string | null>(null);

  const reloadEvidence = useCallback(async () => {
    if (!bundle?.service) return;
    const rows = await bundle.service.listEvidence(orderId);
    setEvidence(rows);
  }, [bundle?.service, orderId]);

  useEffect(() => {
    void reloadEvidence();
  }, [reloadEvidence]);

  useEffect(() => {
    void (async () => {
      const { data } = await operationalDb
        .from("operational_scan_records")
        .select("barcode_value, scan_type, verification_status, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(5);
      const rows = (data ?? []) as {
        barcode_value: string | null;
        scan_type: string;
        verification_status: string;
      }[];
      const gate = rows.find((s) => s.scan_type === "dispatch_gate" && s.verification_status === "verified");
      const carton = rows.find((s) => s.scan_type === "carton" && s.verification_status === "verified");
      if (gate?.barcode_value) setGateRef((prev) => prev || String(gate.barcode_value));
      const parts: string[] = [];
      if (gate) parts.push(`gate scan: ${gate.barcode_value}`);
      if (carton) parts.push(`carton: ${carton.barcode_value}`);
      setScanHint(parts.length > 0 ? parts.join(" · ") : "No verified operational_scan_records yet");
    })();
  }, [orderId]);

  const hasVerified = (type: string) =>
    evidence.some((e) => e.evidenceType === type && e.evidenceStatus === "verified");

  const addEvidence = async (
    evidenceType: "packing_photo" | "document_placeholder" | "gate_scan",
    evidenceRef: string,
    photoRef: string | null = null,
  ) => {
    if (!canRecordEvidence || !bundle?.service) return;
    const ref = evidenceRef.trim();
    if (!ref) return;
    setBusy(evidenceType);
    try {
      await bundle.service.addEvidence(
        {
          orderId,
          queueItemId: null,
          evidenceType,
          evidenceStatus: "verified",
          evidenceRef: ref,
          photoRef,
          documentRef: evidenceType === "document_placeholder" ? ref : null,
          barcodeRef: evidenceType === "gate_scan" ? ref : null,
          actorId: null,
          actorRole: null,
          actorDepartment: null,
          correlationId: writeCtx().correlationId,
          metadata: { source: "governance_ui_14b", governedOnly: true },
        },
        writeCtx(),
      );
      await reloadEvidence();
      onRecorded();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border/80 bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Record readiness evidence (4B)
      </p>

      <div className="flex flex-wrap gap-1">
        {(Object.keys(DIMENSION_LABELS) as DispatchReadinessDimension[]).map((dim) => (
          <Badge key={dim} variant={dimensionResults[dim] ? "default" : "outline"} className="text-[10px]">
            {DIMENSION_LABELS[dim]}
          </Badge>
        ))}
      </div>

      {evidence.length > 0 && (
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {evidence.map((e) => (
            <li key={e.id} className="font-mono">
              {e.evidenceType} · {e.evidenceStatus}
              {e.evidenceRef ? ` · ${e.evidenceRef.slice(0, 48)}` : ""}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium">Packing photo reference</label>
            <Input
              className="h-8 text-xs"
              placeholder="storage path or media vault ref"
              value={packingRef}
              onChange={(e) => setPackingRef(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canRecordEvidence || !!busy || hasVerified("packing_photo")}
            onClick={() => void addEvidence("packing_photo", packingRef, packingRef || null)}
          >
            {busy === "packing_photo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            <span className="ml-1">Record packing photo</span>
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium">Document placeholder (e-way / invoice slot)</label>
            <Input
              className="h-8 text-xs"
              placeholder="EWAY-slot or PI placeholder ref"
              value={documentRef}
              onChange={(e) => setDocumentRef(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canRecordEvidence || !!busy || hasVerified("document_placeholder")}
            onClick={() => void addEvidence("document_placeholder", documentRef)}
          >
            {busy === "document_placeholder" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            <span className="ml-1">Record document slot</span>
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium">Gate scan evidence ref</label>
            <Input
              className="h-8 text-xs"
              placeholder="barcode or gate scan id"
              value={gateRef}
              onChange={(e) => setGateRef(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">{scanHint}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canRecordEvidence || !!busy || hasVerified("gate_scan")}
            onClick={() => void addEvidence("gate_scan", gateRef)}
          >
            {busy === "gate_scan" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />}
            <span className="ml-1">Record gate scan</span>
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Operational scans:{" "}
        <Link to="/security-gate" className="text-primary underline">
          Security Gate
        </Link>{" "}
        (writes <code className="text-[10px]">operational_scan_records</code>). Gate eligibility for finance uses{" "}
        <code className="text-[10px]">dispatch_readiness_evidence</code> with verified gate_scan or manual_readiness_review.
      </p>
    </div>
  );
}
