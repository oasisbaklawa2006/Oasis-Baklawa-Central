import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { pnaAssemblyRpc } from "@/lib/pnaAssemblyRpc";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type AssemblyQcGate = "INPUT_MATERIAL" | "FIRST_PIECE" | "IN_PROCESS" | "FINAL";
export type AssemblyQcDecision = "PASS" | "FAIL" | "HOLD";
type QcEvent = {
  id: string;
  event_seq: number;
  assembly_job_id: string;
  gate: AssemblyQcGate;
  decision: AssemblyQcDecision;
  sample_qty: number;
  evidence_reference: string;
  reason: string | null;
  inspected_by: string;
  created_at: string;
};
type Commissioning = { enforced: boolean; policy_version: string | null };
type QcReadResult = { data: unknown; error: { message: string } | null };
type QcQuery = {
  eq: (field: string, value: string | boolean) => QcQuery;
  maybeSingle: () => Promise<QcReadResult>;
  order: (field: string, options: { ascending: boolean }) => {
    limit: (amount: number) => Promise<QcReadResult>;
  };
};
const qcDb = supabase as unknown as {
  from: (relation: string) => { select: (fields: string) => QcQuery };
};

const GATES: readonly { code: AssemblyQcGate; label: string }[] = [
  { code: "INPUT_MATERIAL", label: "1. Input material QC" },
  { code: "FIRST_PIECE", label: "2. First-piece approval" },
  { code: "IN_PROCESS", label: "3. In-process sampling" },
  { code: "FINAL", label: "4. Final QC" },
];

export function canRecordAssemblyQcGate(jobStatus: string, gate: AssemblyQcGate): boolean {
  if (gate === "INPUT_MATERIAL") return ["partially_reserved", "materials_reserved"].includes(jobStatus);
  if (gate === "FIRST_PIECE" || gate === "IN_PROCESS") return jobStatus === "in_progress";
  return jobStatus === "qc_pending";
}

export default function AssemblyQcPanel({
  jobId, jobStatus, retryCorrelations,
}: {
  jobId: string;
  jobStatus: string;
  // Parent owns outstanding retry keys so changing the selected job cannot lose
  // the correlation of a request that may already have committed in Core.
  retryCorrelations?: Map<string, string>;
}) {
  const [events, setEvents] = useState<QcEvent[]>([]);
  const [commissioning, setCommissioning] = useState<Commissioning | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [gate, setGate] = useState<AssemblyQcGate>("INPUT_MATERIAL");
  const [decision, setDecision] = useState<AssemblyQcDecision>("PASS");
  const [sampleQty, setSampleQty] = useState("");
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const localRetryCorrelations = useRef(new Map<string, string>());
  const correlations = retryCorrelations ?? localRetryCorrelations.current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // A new or failed job read cannot retain another job's prior PASS badges.
    setCommissioning(null);
    setEvents([]);
    try {
      // Query each gate independently. Limiting a combined event stream
      // hides earlier valid approvals when one stage has >250 newer records.
      const [configResult, ...gateResults] = await Promise.all([
        qcDb.from("assembly_qc_commissioning_v1")
          .select("enforced, policy_version").eq("id", true).maybeSingle(),
        ...GATES.map((stage) => qcDb.from("assembly_qc_gate_events_v1")
          .select("id, event_seq, assembly_job_id, gate, decision, sample_qty, evidence_reference, reason, inspected_by, created_at")
          .eq("assembly_job_id", jobId).eq("gate", stage.code)
          .order("event_seq", { ascending: false }).limit(1)),
      ]);
      if (configResult.error) throw new Error(`QC commissioning: ${configResult.error.message}`);
      if (!configResult.data) throw new Error("Assembly QC commissioning authority is unavailable");
      const latest: QcEvent[] = [];
      for (const [index, result] of gateResults.entries()) {
        const stage = GATES[index];
        if (result.error) throw new Error(`QC ${stage.code}: ${result.error.message}`);
        if (!Array.isArray(result.data) || result.data.length > 1) {
          throw new Error(`Assembly QC ${stage.code} authority response is incomplete`);
        }
        for (const event of result.data as QcEvent[]) {
          if (event.assembly_job_id !== jobId || event.gate !== stage.code) {
            throw new Error(`Assembly QC ${stage.code} evidence does not match the selected job`);
          }
          latest.push(event);
        }
      }
      setCommissioning(configResult.data as Commissioning);
      setEvents(latest);
    } catch (cause) {
      setCommissioning(null);
      setEvents([]);
      setError(cause instanceof Error ? cause.message : "Assembly QC evidence unavailable");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const record = useCallback(async () => {
    const qty = Number(sampleQty);
    if (!canRecordAssemblyQcGate(jobStatus, gate)) {
      toast.error("This QC stage is not available in the current assembly job status");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0 || !evidence.trim() || (decision !== "PASS" && !reason.trim())) {
      toast.error("Provide sampled quantity, evidence reference and a reason for a hold or failure");
      return;
    }
    const fingerprint = JSON.stringify([jobId, gate, decision, qty, evidence.trim(), reason.trim()]);
    // Preserve each unresolved (job + payload) correlation across select changes
    // and keyed panel remounts. Only a confirmed Core success removes its key.
    let correlationId = correlations.get(fingerprint);
    if (!correlationId) {
      correlationId = crypto.randomUUID();
      correlations.set(fingerprint, correlationId);
    }

    setActing(true);
    try {
      const { error: rpcError } = await pnaAssemblyRpc.rpc("record_assembly_qc_gate_v1", {
        p_assembly_job_id: jobId,
        p_gate: gate,
        p_decision: decision,
        p_sample_qty: qty,
        p_evidence_reference: evidence.trim(),
        p_reason: reason.trim() || null,
        p_correlation_id: correlationId,
      });
      if (rpcError) {
        toast.error(`QC result not recorded: ${rpcError.message}`);
        return;
      }
      correlations.delete(fingerprint);
      setSampleQty("");
      setEvidence("");
      setReason("");
      toast.success("Assembly QC evidence recorded by Core");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "QC recording failed");
    } finally {
      setActing(false);
    }
  }, [jobId, jobStatus, gate, decision, sampleQty, evidence, reason, load, correlations]);

  const latestByStage = new Map<AssemblyQcGate, QcEvent>();
  for (const event of events) if (!latestByStage.has(event.gate)) latestByStage.set(event.gate, event);

  return (
    <Card data-testid="assembly-four-gate-qc">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />Four-stage governed quality control
          </CardTitle>
          <Button variant="outline" size="sm" type="button" disabled={loading || acting} onClick={() => void load()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh QC
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading Core inspection authority…</p>}
        {error && <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />QC data unavailable: {error}. Do not assume approval.
        </p>}
        {commissioning && !commissioning.enforced && (
          <p className="text-xs text-amber-800">Pilot evidence only. Core four-gate enforcement is not commissioned for production.</p>
        )}
        {commissioning && commissioning.enforced && (
          <p className="text-xs text-muted-foreground">
            Core enforces four QC approvals on Assembly transitions. Policy: {commissioning.policy_version ?? "not specified"}.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {GATES.map((item) => {
            const latest = latestByStage.get(item.code);
            return (
              <div key={item.code} className="rounded-md border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  <Badge variant={latest?.decision === "FAIL" || latest?.decision === "HOLD" ? "destructive" : "outline"}>
                    {latest?.decision ?? "Not evidenced"}
                  </Badge>
                </div>
                {latest && <p className="mt-2 break-all text-muted-foreground">
                  Sample {latest.sample_qty} · {latest.evidence_reference} · {new Date(latest.created_at).toLocaleString()}
                </p>}
              </div>
            );
          })}
        </div>
        {commissioning && (
          <div className="space-y-3 border-t pt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs">Inspection stage
                <Select value={gate} onValueChange={(next) => setGate(next as AssemblyQcGate)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GATES.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-xs">Result
                <Select value={decision} onValueChange={(next) => setDecision(next as AssemblyQcDecision)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASS">Pass</SelectItem>
                    <SelectItem value="FAIL">Fail</SelectItem>
                    <SelectItem value="HOLD">Hold</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-xs">Sampled quantity
                <Input type="number" min="0.001" step="0.001" value={sampleQty} onChange={(e) => setSampleQty(e.target.value)} />
              </label>
            </div>
            <label className="block space-y-1 text-xs">Evidence reference (approved image / inspection record)
              <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Verified protected media/document reference" />
            </label>
            <label className="block space-y-1 text-xs">Hold/failure reason, or inspection notes
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <Button size="sm" type="button" disabled={acting || !canRecordAssemblyQcGate(jobStatus, gate)}
              onClick={() => void record()}>
              {acting ? "Recording…" : "Record with Core QC authority"}
            </Button>
            {!canRecordAssemblyQcGate(jobStatus, gate) && (
              <p className="text-xs text-muted-foreground">The selected gate is not valid while this job is {jobStatus.replace(/_/g," ")}.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
