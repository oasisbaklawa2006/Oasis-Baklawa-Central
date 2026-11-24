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
type QcOrderedQuery = { limit: (amount: number) => Promise<QcReadResult> };
type QcQuery = {
  eq: (field: string, value: string | boolean) => QcQuery;
  lt: (field: string, value: number) => QcQuery;
  maybeSingle: () => Promise<QcReadResult>;
  order: (field: string, options: { ascending: boolean }) => QcOrderedQuery;
};
const QC_EVENT_FIELDS = "id, event_seq, assembly_job_id, gate, decision, sample_qty, evidence_reference, reason, inspected_by, created_at";
const QC_HISTORY_PAGE_SIZE = 50;
function validateQcHistory(result: QcReadResult, jobId: string): QcEvent[] {
  if (result.error) throw new Error(`QC inspection history: ${result.error.message}`);
  if (!Array.isArray(result.data) || result.data.length > QC_HISTORY_PAGE_SIZE + 1) {
    throw new Error("Assembly QC inspection history response is incomplete");
  }
  const rows = result.data as QcEvent[];
  if (rows.some((item) => item.assembly_job_id !== jobId || !GATES.some((gate) => gate.code === item.gate))) {
    throw new Error("Assembly QC inspection history does not match the selected job");
  }
  return rows;
}
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
  const [history, setHistory] = useState<QcEvent[]>([]);
  const [hasOlderHistory, setHasOlderHistory] = useState(false);
  const [loadingOlderHistory, setLoadingOlderHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyVersion = useRef(0);
  const historyRequestInFlight = useRef(false);
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
    const version = ++historyVersion.current;
    historyRequestInFlight.current = false;
    setLoading(true);
    setError(null);
    setHistoryError(null);
    setLoadingOlderHistory(false);
    setHasOlderHistory(false);
    // A failed authority read must not retain prior PASS badges or audit entries.
    setCommissioning(null);
    setEvents([]);
    setHistory([]);
    try {
      // Keep latest-by-gate badge queries independent of audit pagination:
      // one inspection stage can accumulate hundreds of later rechecks.
      const [configResult, ...readResults] = await Promise.all([
        qcDb.from("assembly_qc_commissioning_v1")
          .select("enforced, policy_version").eq("id", true).maybeSingle(),
        ...GATES.map((stage) => qcDb.from("assembly_qc_gate_events_v1")
          .select(QC_EVENT_FIELDS)
          .eq("assembly_job_id", jobId).eq("gate", stage.code)
          .order("event_seq", { ascending: false }).limit(1)),
        qcDb.from("assembly_qc_gate_events_v1")
          .select(QC_EVENT_FIELDS).eq("assembly_job_id", jobId)
          .order("event_seq", { ascending: false }).limit(QC_HISTORY_PAGE_SIZE + 1),
      ]);
      if (version !== historyVersion.current) return;
      const gateResults = readResults.slice(0, GATES.length);
      const initialHistoryResult = readResults[GATES.length];
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
      const audit = validateQcHistory(initialHistoryResult, jobId);
      setCommissioning(configResult.data as Commissioning);
      setEvents(latest);
      setHistory(audit.slice(0, QC_HISTORY_PAGE_SIZE));
      setHasOlderHistory(audit.length > QC_HISTORY_PAGE_SIZE);
    } catch (cause) {
      if (version === historyVersion.current) {
        setCommissioning(null);
        setEvents([]);
        setHistory([]);
        setHasOlderHistory(false);
        setError(cause instanceof Error ? cause.message : "Assembly QC evidence unavailable");
      }
    } finally {
      if (version === historyVersion.current) setLoading(false);
    }
  }, [jobId]);

  const loadOlderHistory = useCallback(async () => {
    // Cursor pagination is stable when new append-only QC events arrive while
    // an operator browses old evidence. Avoid offset shifting/duplication.
    if (loading || historyRequestInFlight.current || !hasOlderHistory || history.length === 0) return;
    historyRequestInFlight.current = true;
    const version = historyVersion.current;
    const oldestSeq = history[history.length - 1].event_seq;
    setLoadingOlderHistory(true);
    setHistoryError(null);
    try {
      const result = await qcDb.from("assembly_qc_gate_events_v1")
        .select(QC_EVENT_FIELDS).eq("assembly_job_id", jobId)
        .lt("event_seq", oldestSeq)
        .order("event_seq", { ascending: false }).limit(QC_HISTORY_PAGE_SIZE + 1);
      if (version !== historyVersion.current) return;
      const older = validateQcHistory(result, jobId);
      if (older.some((event) => event.event_seq >= oldestSeq)) {
        throw new Error("Assembly QC history cursor returned an invalid event");
      }
      setHistory((previous) => [...previous, ...older.slice(0, QC_HISTORY_PAGE_SIZE)]);
      setHasOlderHistory(older.length > QC_HISTORY_PAGE_SIZE);
    } catch (cause) {
      if (version === historyVersion.current) {
        setHistoryError(cause instanceof Error ? cause.message : "Older QC history is unavailable");
      }
    } finally {
      if (version === historyVersion.current) {
        historyRequestInFlight.current = false;
        setLoadingOlderHistory(false);
      }
    }
  }, [hasOlderHistory, history, jobId, loading]);

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
        <div className="grid gap-2 sm:grid-cols-2" data-testid="assembly-qc-latest-gates">
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
          <section className="space-y-2 border-t pt-3" aria-label="Assembly QC inspection history">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Recorded QC inspection history</h3>
              <span className="text-xs text-muted-foreground">{history.length} events loaded</span>
            </div>
            {history.length === 0 && <p className="text-xs text-muted-foreground">No inspection events recorded for this job.</p>}
            <ol className="max-h-80 space-y-2 overflow-y-auto" aria-label="QC event history">
              {history.map((event) => (
                <li key={event.id} className="rounded-md border p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">QC event #{event.event_seq}</span>
                    <span>{GATES.find((item) => item.code === event.gate)?.label}</span>
                    <Badge variant={event.decision === "PASS" ? "outline" : "destructive"}>{event.decision}</Badge>
                  </div>
                  <p className="mt-1 break-all">Sample: {event.sample_qty} · Evidence: {event.evidence_reference}</p>
                  <p className="mt-1 break-all">Inspector: {event.inspected_by} · {new Date(event.created_at).toLocaleString()}</p>
                  {event.reason && <p className="mt-1 break-words">Reason / notes: {event.reason}</p>}
                </li>
              ))}
            </ol>
            {historyError && <p role="alert" className="text-xs text-destructive">QC history unavailable: {historyError}. Retry loading older events.</p>}
            {hasOlderHistory && (
              <Button type="button" variant="outline" size="sm" disabled={loading || loadingOlderHistory}
                onClick={() => void loadOlderHistory()}>
                {loadingOlderHistory ? "Loading older QC events…" : "Load older QC events"}
              </Button>
            )}
          </section>
        )}
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
