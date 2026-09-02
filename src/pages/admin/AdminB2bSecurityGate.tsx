import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine, ShieldAlert, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { releaseB2bCartonAtDispatchGate } from "@/lib/order-authority/gateExitAuthorityClient";
import {
  getFinanceExitFacts,
  recordDispatchProof,
  type DispatchTransportMode,
  type FinanceExitFacts,
} from "@/lib/order-authority/financeExitAuthorityClient";
import {
  GATE_SCAN_POST_RELEASE_STATUS,
  GATE_SCAN_PRE_RELEASE_STATUS,
  GATE_SCAN_RELEASE_DENIED_STATUS,
  gateScanCorrelationId,
} from "@/utils/gateScanEvidence";

type ScreenState = "idle" | "success" | "error" | "duplicate";
type HistoryRow = { id: string; barcode: string; consignment: string; status: ScreenState; message: string; scannedAt: Date };

const toIso = (value: string, field: string) => {
  if (!value) throw new Error(`${field} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`);
  return date.toISOString();
};
const refs = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const deadlineLabel = (value: string | null) => {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const AdminB2bSecurityGate = () => {
  const { user, role } = useAuth();
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [dispatchProofProcessing, setDispatchProofProcessing] = useState(false);
  const [state, setState] = useState<ScreenState>("idle");
  const [message, setMessage] = useState("Ready to scan governed B2B carton barcode.");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [evidenceOrderId, setEvidenceOrderId] = useState("");
  const [latestScannedOrderId, setLatestScannedOrderId] = useState("");
  const [handoffFacts, setHandoffFacts] = useState<FinanceExitFacts | null>(null);
  const [transporter, setTransporter] = useState("");
  const [transportMode, setTransportMode] = useState<DispatchTransportMode>("ROAD");
  const [lrAwbBilty, setLrAwbBilty] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [dispatchEvidence, setDispatchEvidence] = useState("");
  const [dispatchedAt, setDispatchedAt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const active = document.activeElement;
      if (inputRef.current && (active === document.body || active == null)) inputRef.current.focus();
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const addHistory = (barcode: string, consignment: string, status: ScreenState, text: string) => {
    setHistory((rows) => [{ id: crypto.randomUUID(), barcode, consignment, status, message: text, scannedAt: new Date() }, ...rows].slice(0, 12));
  };

  const resetLater = () => window.setTimeout(() => {
    setState("idle");
    setMessage("Ready to scan next governed B2B carton.");
  }, 3500);

  const handleScan = async (event: React.FormEvent) => {
    event.preventDefault();
    const barcode = input.trim();
    if (!barcode || processing) return;
    setInput("");
    setProcessing(true);
    try {
      const { data: carton, error: cartonError } = await supabase
        .from("b2b_dispatch_cartons")
        .select("id,carton_code,status,consignment_id")
        .eq("carton_code", barcode)
        .maybeSingle();
      if (cartonError || !carton) {
        setState("error");
        setMessage(`INVALID B2B CARTON: ${barcode}`);
        addHistory(barcode, "Unknown", "error", "Barcode is not a governed B2B dispatch carton.");
        return;
      }

      const { data: consignment, error: consignmentError } = await supabase
        .from("b2b_dispatch_consignments")
        .select("order_id,consignment_number,status")
        .eq("id", carton.consignment_id)
        .single();
      if (consignmentError || !consignment) throw new Error(consignmentError?.message || "Consignment lineage missing");
      if (latestScannedOrderId && latestScannedOrderId !== consignment.order_id) setHandoffFacts(null);
      setLatestScannedOrderId(consignment.order_id);
      setEvidenceOrderId(consignment.order_id);

      if (carton.status === "handed_over") {
        setState("duplicate");
        setMessage(`ALREADY RELEASED: ${carton.carton_code}`);
        addHistory(barcode, consignment.consignment_number, "duplicate", "This carton already passed the governed physical gate.");
        return;
      }

      const correlationId = gateScanCorrelationId(carton.id, barcode);
      const { data: scan, error: scanError } = await supabase
        .from("operational_scan_records")
        .insert({
          scan_type: "dispatch_gate",
          verification_type: "gate_check",
          entity_type: "dispatch_carton",
          entity_id: carton.id,
          order_id: consignment.order_id,
          barcode_value: barcode,
          expected_barcode: carton.carton_code,
          verification_status: GATE_SCAN_PRE_RELEASE_STATUS,
          scan_source: "admin_b2b_security_gate",
          actor_id: user?.id ?? null,
          actor_role: role ?? null,
          correlation_id: correlationId,
        })
        .select("id")
        .single();
      if (scanError || !scan?.id) throw new Error(scanError?.message || "Could not freeze gate scan evidence");

      const result = await releaseB2bCartonAtDispatchGate(carton.id, scan.id);
      if (!result.ok) {
        const blockerText = result.blockers.map((blocker) => blocker.message || blocker.code).join("; ") || "Gate release denied";
        const { error: denialEvidenceError } = await supabase
          .from("operational_scan_records")
          .update({ verification_status: GATE_SCAN_RELEASE_DENIED_STATUS, mismatch_reason: blockerText })
          .eq("id", scan.id);
        if (denialEvidenceError) toast.error(`Gate denial was authoritative, but scan evidence refresh failed: ${denialEvidenceError.message}`);
        setState("error");
        setMessage(`BLOCKED — ${blockerText}`);
        addHistory(barcode, consignment.consignment_number, "error", blockerText);
        return;
      }

      const { error: verifyError } = await supabase
        .from("operational_scan_records")
        .update({ verification_status: GATE_SCAN_POST_RELEASE_STATUS })
        .eq("id", scan.id);
      if (verifyError) throw new Error(verifyError.message);
      setState("success");
      setMessage(`AUTHORIZED: ${carton.carton_code} — ${consignment.consignment_number}`);
      addHistory(barcode, consignment.consignment_number, "success", "Finance Dispatch Clearance, final DPL membership and E-way evidence revalidated by Core.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Gate system error");
      toast.error(error instanceof Error ? error.message : "Gate system error");
    } finally {
      setProcessing(false);
      resetLater();
    }
  };

  const evidenceOrder = () => {
    const orderId = evidenceOrderId.trim();
    if (!orderId) throw new Error("Scan a governed B2B carton before freezing proof");
    if (!latestScannedOrderId || orderId !== latestScannedOrderId) {
      throw new Error("Order UUID does not match the most recently scanned consignment");
    }
    return orderId;
  };

  const freezeDispatchProof = async () => {
    if (!user?.id) {
      toast.error("Authenticated dispatch/gate actor required");
      return;
    }
    const evidenceReferences = refs(dispatchEvidence);
    if (evidenceReferences.length === 0) {
      toast.error("At least one dispatch evidence reference is required");
      return;
    }
    const orderId = evidenceOrder();
    setDispatchProofProcessing(true);
    try {
      await recordDispatchProof({
        orderId,
        transporter,
        transportMode,
        lrAwbBilty,
        vehicleNumber,
        driverName,
        driverPhone,
        trackingReference,
        evidenceReferences,
        dispatchedAt: toIso(dispatchedAt, "Actual gate departure"),
        actorId: user.id,
      });
      const facts = await getFinanceExitFacts(orderId);
      setHandoffFacts(facts);
      toast.success("Immutable gate-exit dispatch proof frozen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dispatch proof failed");
    } finally {
      setDispatchProofProcessing(false);
    }
  };

  const visual = state === "success"
    ? { bg: "bg-emerald-600", text: "text-white", Icon: ShieldCheck, title: "AUTHORIZED" }
    : state === "error" || state === "duplicate"
      ? { bg: "bg-red-700", text: "text-white", Icon: ShieldAlert, title: state === "duplicate" ? "DUPLICATE" : "BLOCKED" }
      : { bg: "bg-slate-950", text: "text-slate-300", Icon: ScanLine, title: "SCAN B2B CARTON" };

  const roadCredentialsRequired = transportMode === "ROAD";
  const vehicleRequired = roadCredentialsRequired || transportMode === "CUSTOMER_PICKUP";

  return (
    <div className="min-h-screen bg-slate-950 text-white lg:flex">
      <section className={`flex min-h-[70vh] flex-1 flex-col items-center justify-center p-8 transition-colors ${visual.bg}`}>
        <visual.Icon className={`mb-6 h-28 w-28 ${visual.text}`} strokeWidth={1.5} />
        <h1 className={`text-center text-5xl font-black tracking-tight md:text-7xl ${visual.text}`}>{visual.title}</h1>
        <p className="mt-5 max-w-3xl text-center text-lg font-medium text-white/80">{message}</p>
        <form onSubmit={(event) => { void handleScan(event); }} className="mt-10 w-full max-w-xl">
          <input ref={inputRef} value={input} onChange={(event) => { setInput(event.target.value); }} autoFocus autoComplete="off"
            placeholder="Scanner / carton barcode" className="w-full rounded-2xl border border-white/20 bg-black/40 px-5 py-5 text-center font-mono text-xl text-white outline-none focus:border-white" />
        </form>
        {processing && <p className="mt-5 text-sm"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Revalidating Core gate authority…</p>}
        <div className="mt-8 max-w-2xl rounded-xl border border-white/15 bg-black/20 p-4 text-center text-xs text-white/70">
          No local invoice/payment/E-way threshold checks are trusted here. Core independently requires Finance Dispatch Clearance, exact Finance-frozen DPL carton membership and governed E-way evidence at every physical exit scan.
        </div>
      </section>

      <aside className="w-full border-l border-slate-800 bg-slate-900 p-5 lg:w-[480px] lg:max-h-screen lg:overflow-auto">
        <h2 className="font-semibold">Recent gate decisions</h2>
        <div className="mt-4 space-y-2">
          {history.length === 0 && <p className="text-sm text-slate-500">No cartons scanned this session.</p>}
          {history.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-3"><span className="font-mono text-sm">{row.barcode}</span><span className={row.status === "success" ? "text-emerald-400" : "text-red-400"}>{row.status}</span></div>
              <p className="mt-1 text-xs text-slate-400">{row.consignment}</p>
              <p className="mt-1 text-xs text-slate-300">{row.message}</p>
              <p className="mt-1 text-[10px] text-slate-600">{row.scannedAt.toLocaleTimeString()}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-800 pt-5">
          <div className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4" /> Freeze final gate-exit dispatch proof</div>
          <p className="mt-1 text-xs text-slate-500">Core accepts this only after every Finance-frozen DPL carton has independently passed the gate.</p>
          <div className="mt-3 space-y-2">
            <input value={evidenceOrderId} readOnly placeholder="Scan a B2B carton to bind order UUID" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={transporter} onChange={(event) => { setTransporter(event.target.value); }} placeholder="Transporter / carrier" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <select value={transportMode} onChange={(event) => { setTransportMode(event.target.value as DispatchTransportMode); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              <option value="ROAD">Road</option><option value="COURIER">Courier</option><option value="AIR">Air</option><option value="RAIL">Rail</option><option value="HAND_CARRY">Hand carry</option><option value="CUSTOMER_PICKUP">Customer pickup</option><option value="OTHER">Other</option>
            </select>
            <input value={lrAwbBilty} onChange={(event) => { setLrAwbBilty(event.target.value); }} placeholder="LR / AWB / Bilty" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={vehicleNumber} onChange={(event) => { setVehicleNumber(event.target.value); }} placeholder={vehicleRequired ? "Vehicle number (required)" : "Vehicle number, if applicable"} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={driverName} onChange={(event) => { setDriverName(event.target.value); }} placeholder={roadCredentialsRequired ? "Driver name (required)" : "Driver / handler name, if applicable"} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={driverPhone} onChange={(event) => { setDriverPhone(event.target.value); }} placeholder={roadCredentialsRequired ? "Driver phone (required)" : "Driver / handler phone, if applicable"} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={trackingReference} onChange={(event) => { setTrackingReference(event.target.value); }} placeholder="Tracking / consignment reference, if applicable" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input value={dispatchEvidence} onChange={(event) => { setDispatchEvidence(event.target.value); }} placeholder="Gate/departure evidence refs, comma separated" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <input type="datetime-local" value={dispatchedAt} onChange={(event) => { setDispatchedAt(event.target.value); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            <button type="button" onClick={() => { void freezeDispatchProof(); }} disabled={dispatchProofProcessing || !latestScannedOrderId || !!handoffFacts?.dispatchProofId}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">
              {dispatchProofProcessing && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />} Freeze dispatch proof
            </button>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-5">
          <h3 className="font-semibold">Ticket-window handoff</h3>
          <p className="mt-1 text-xs text-slate-500">The 10-calendar-day ticket-raise clock starts from the final invoice date. Gate exit never starts, restarts or extends it.</p>
          {handoffFacts?.dispatchProofId ? (
            <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-xs">
              <p className="font-semibold text-emerald-300">Gate-exit proof recorded</p>
              <p className="mt-2 text-slate-300">Invoice: {handoffFacts.invoiceNumber ?? "—"} · {handoffFacts.invoiceDate ?? "—"}</p>
              <p className="mt-1 text-slate-300">Ticket deadline: {deadlineLabel(handoffFacts.complaintDeadline)}</p>
              <p className="mt-1 text-slate-300">Window: {handoffFacts.complaintWindowOpen ? "OPEN" : "EXPIRED"}</p>
              <p className="mt-2 text-amber-300">Governed customer dispatch communication must still be completed before this thread can be certified complete.</p>
            </div>
          ) : <p className="mt-3 text-xs text-slate-600">Freeze final dispatch proof to load the canonical invoice-based deadline.</p>}
        </div>
      </aside>
    </div>
  );
};

export default AdminB2bSecurityGate;