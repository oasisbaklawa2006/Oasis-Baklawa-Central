import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, ScanLine, Box, Clock, Shield, Truck, Search, CheckCircle, Loader2 } from "lucide-react";
import { sendDispatchAlert, sendSalesExecDispatchNotification } from "@/utils/whatsapp";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface ScannedCarton {
  id: string;
  barcode: string;
  company_name: string;
  scanned_at: Date;
  status: "success" | "error" | "duplicate";
  message: string;
}

interface InwardAdvice {
  id: string;
  company_id: string | null;
  company_name: string;
  reason: string | null;
  expected_value: number | null;
  accompanying_docs: string | null;
  created_at: string | null;
  sales_exec_name: string | null;
  item_count: number;
}

const AdminSecurityGate = () => {
  const { role } = useAuth();
  const isSuperAdmin = role?.toUpperCase() === "SUPER_ADMIN";
  const [activeTab, setActiveTab] = useState<"scanner" | "inward">("scanner");

  // ─── Scanner State (UNCHANGED) ───
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [screenState, setScreenState] = useState<"idle" | "success" | "error" | "duplicate">("idle");
  const [lastMessage, setLastMessage] = useState("Ready to scan barcodes.");
  const [scanHistory, setScanHistory] = useState<ScannedCarton[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Inward State ───
  const [inwardAdvices, setInwardAdvices] = useState<InwardAdvice[]>([]);
  const [inwardLoading, setInwardLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [arrivalModal, setArrivalModal] = useState<InwardAdvice | null>(null);
  const [boxCount, setBoxCount] = useState("");
  const [markingSaving, setMarkingSaving] = useState(false);

  // Keep the hidden input focused at all times so the USB scanner always works
  useEffect(() => {
    if (activeTab !== "scanner") return;
    const focusInterval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, [activeTab]);

  // Fetch inward advices when tab switches
  useEffect(() => {
    if (activeTab === "inward") fetchInwardAdvices();
  }, [activeTab]);

  const fetchInwardAdvices = async () => {
    setInwardLoading(true);
    const { data: advices } = await supabase
      .from("inward_material_advice")
      .select("id, company_id, reason, expected_value, accompanying_docs, created_at, sales_exec_id, status")
      .eq("status", "expected");

    if (!advices || advices.length === 0) {
      setInwardAdvices([]);
      setInwardLoading(false);
      return;
    }

    // Get company names
    const companyIds = [...new Set(advices.map((a) => a.company_id).filter(Boolean))] as string[];
    const execIds = [...new Set(advices.map((a) => a.sales_exec_id).filter(Boolean))] as string[];

    const [{ data: companies }, { data: execs }, { data: items }] = await Promise.all([
      companyIds.length > 0
        ? supabase.from("companies").select("id, business_name").in("id", companyIds)
        : { data: [] },
      execIds.length > 0
        ? supabase.from("users").select("id, full_name, name").in("id", execIds)
        : { data: [] },
      supabase
        .from("inward_material_items")
        .select("advice_id")
        .in("advice_id", advices.map((a) => a.id)),
    ]);

    const companyMap: Record<string, string> = {};
    (companies || []).forEach((c: any) => { companyMap[c.id] = c.business_name; });
    const execMap: Record<string, string> = {};
    (execs || []).forEach((e: any) => { execMap[e.id] = e.full_name || e.name || e.id.slice(0, 8); });

    // Count items per advice
    const itemCountMap: Record<string, number> = {};
    (items || []).forEach((it: any) => {
      itemCountMap[it.advice_id] = (itemCountMap[it.advice_id] || 0) + 1;
    });

    setInwardAdvices(
      advices.map((a) => ({
        id: a.id,
        company_id: a.company_id,
        company_name: a.company_id ? companyMap[a.company_id] || "Unknown" : "Unknown",
        reason: a.reason,
        expected_value: a.expected_value,
        accompanying_docs: a.accompanying_docs,
        created_at: a.created_at,
        sales_exec_name: a.sales_exec_id ? execMap[a.sales_exec_id] || "—" : "—",
        item_count: itemCountMap[a.id] || 0,
      }))
    );
    setInwardLoading(false);
  };

  const filteredAdvices = useMemo(() => {
    if (!searchTerm.trim()) return inwardAdvices;
    const q = searchTerm.toLowerCase();
    return inwardAdvices.filter((a) => a.company_name.toLowerCase().includes(q));
  }, [inwardAdvices, searchTerm]);

  const handleMarkArrived = async () => {
    if (!arrivalModal) return;
    if (!boxCount || parseInt(boxCount) < 0) {
      toast.error("Enter the physical box count.");
      return;
    }
    setMarkingSaving(true);

    const { error } = await supabase
      .from("inward_material_advice")
      .update({ status: "at_gate", gate_entry_id: null })
      .eq("id", arrivalModal.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      // Audit log
      await supabase.from("audit_logs").insert({
        action_type: "inward_marked_at_gate",
        entity_id: arrivalModal.id,
        entity_name: "inward_material_advice",
        new_value: { company: arrivalModal.company_name, physical_box_count: parseInt(boxCount), expected_items: arrivalModal.item_count },
      });
      toast.success(`Arrival marked for ${arrivalModal.company_name}`);
      setArrivalModal(null);
      setBoxCount("");
      fetchInwardAdvices();
    }
    setMarkingSaving(false);
  };

  // ─── Scanner Logic (UNCHANGED) ───
  const resetScreen = () => {
    setTimeout(() => {
      setScreenState("idle");
      setLastMessage("Ready to scan next carton.");
    }, 4000);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = inputValue.trim();
    if (!barcode || isProcessing) return;

    setInputValue("");
    setIsProcessing(true);

    try {
      const { data: carton, error } = await (supabase as any)
        .from("dispatch_cartons")
        .select(
          `id, status, box_number, total_boxes, order_id,
          orders ( status, company:companies(business_name, state), payment_status, payment_cleared, eway_bill_number, eway_bill_url, sales_order_value, final_invoice_url )`
        )
        .eq("barcode_string", barcode)
        .single();

      const companyName = carton?.orders?.company?.business_name || "Unknown Company";

      if (error || !carton) {
        setScreenState("error");
        setLastMessage(`INVALID BARCODE: ${barcode}`);
        addToHistory(barcode, "Unknown", "error", "Barcode not recognized by the system.");
        playAudio("error");
      } else if (carton.status === "physically_dispatched") {
        setScreenState("duplicate");
        setLastMessage(`ALREADY DISPATCHED: Master Carton ${carton.box_number} of ${carton.total_boxes}`);
        addToHistory(barcode, companyName, "duplicate", "This box has already left the building.");
        playAudio("error");
      } else {
        // ═══ 3-POINT VERIFICATION CHECK ═══
        const orderStatus = carton.orders?.status || "";
        const hasInvoice = !!carton.orders?.final_invoice_url;
        const orderValue = Number(carton.orders?.sales_order_value) || 0;
        const destState = (carton.orders?.company?.state || "").trim().toLowerCase();
        const isIntrastate = destState === "delhi" || destState === "new delhi";
        const ewayThreshold = isIntrastate ? 100000 : 50000;
        const needsEway = orderValue > ewayThreshold;
        const hasEway = !!carton.orders?.eway_bill_number;

        const check1 = orderStatus === "cleared_for_dispatch";
        const check2 = hasInvoice;
        const check3 = !needsEway || hasEway;

        const failures: string[] = [];
        if (!check1) failures.push(`Status: ${orderStatus.toUpperCase()} (Expected: CLEARED_FOR_DISPATCH)`);
        if (!check2) failures.push("Tax Invoice: NOT UPLOADED");
        if (!check3) failures.push(`E-Way Bill: MISSING (Order > ₹${ewayThreshold.toLocaleString("en-IN")})`);

        if (failures.length === 0) {
          // ALL PASS — GREEN RELEASE
          await (supabase as any)
            .from("dispatch_cartons")
            .update({ status: "physically_dispatched", scanned_out_at: new Date().toISOString() })
            .eq("id", carton.id);

          // Check if all cartons for this order are dispatched
          if (carton.order_id) {
            const { data: allCartons } = await supabase
              .from("dispatch_cartons")
              .select("id, status")
              .eq("order_id", carton.order_id);
            const allDispatched = (allCartons || []).every((c: any) => c.status === "physically_dispatched" || c.id === carton.id);
            if (allDispatched) {
              const { data: dispRows } = await supabase
                .from("dispatches")
                .select("transporter_name, tracking_number, proof_storage_path, is_partial")
                .eq("order_id", carton.order_id);
              const hasFullClosureProof = (dispRows || []).some(
                (d: {
                  transporter_name: string | null;
                  tracking_number: string | null;
                  proof_storage_path: string | null;
                  is_partial: boolean | null;
                }) =>
                  d.is_partial === false &&
                  (d.transporter_name || "").trim().length > 0 &&
                  (d.tracking_number || "").trim().length > 0 &&
                  (d.proof_storage_path || "").trim().length > 0,
              );

              if (!hasFullClosureProof) {
                toast.error(
                  "Order cannot close: add a full shipment dispatch with transporter, LR/AWB, and proof in Packing & Dispatch (or Finance gate pass) first.",
                );
                setScreenState("success");
                setLastMessage(
                  "Carton released — order stays open until dispatch proof (full shipment) is recorded.",
                );
                addToHistory(barcode, companyName, "success", "Released; order closure pending dispatch proof.");
                playAudio("success");
                return;
              }

              await supabase.from("orders").update({
                status: "dispatched",
                actual_despatch_date: new Date().toISOString().split("T")[0],
              }).eq("id", carton.order_id);
              await supabase.from("order_status_history").insert({
                order_id: carton.order_id, old_status: "cleared_for_dispatch", new_status: "dispatched",
              });

              // ═══ WHATSAPP DISPATCH ALERTS ═══
              try {
                const companyId = carton.orders?.company?.id || "";
                const orderVal = Number(carton.orders?.sales_order_value) || 0;

                // Get client phone from b2b_applications
                if (companyName && companyName !== "Unknown Company") {
                  const { data: appData } = await supabase
                    .from("b2b_applications")
                    .select("contact_phone, mobile_number")
                    .eq("business_name", companyName)
                    .eq("status", "approved")
                    .limit(1);
                  const clientPhone = appData?.[0]?.mobile_number || appData?.[0]?.contact_phone || "";
                  
                  if (clientPhone) {
                    sendDispatchAlert({
                      phone: clientPhone,
                      companyId: carton.orders?.company?.id || "",
                      companyName,
                      orderId: carton.order_id!,
                      trackingNumber: carton.orders?.tracking_number || undefined,
                      invoiceUrl: carton.orders?.final_invoice_url || undefined,
                    });
                  }
                }

                // Notify Sales Executive
                const { data: companyData } = await supabase
                  .from("companies")
                  .select("account_manager_id")
                  .eq("business_name", companyName)
                  .limit(1);
                const managerId = companyData?.[0]?.account_manager_id;
                if (managerId) {
                  const { data: execData } = await supabase
                    .from("users")
                    .select("phone")
                    .eq("id", managerId)
                    .single();
                  if (execData?.phone) {
                    sendSalesExecDispatchNotification({
                      execPhone: execData.phone,
                      companyName,
                      orderId: carton.order_id!,
                      orderValue: orderVal,
                    });
                  }
                }
              } catch (waErr) {
                console.error("WhatsApp dispatch alert failed (non-blocking):", waErr);
              }
            }
          }

          setScreenState("success");
          setLastMessage(`✅ RELEASE AUTHORIZED: ${companyName} (Carton ${carton.box_number}/${carton.total_boxes})`);
          addToHistory(barcode, companyName, "success", "3-Point Check PASSED. Authorized and dispatched.");
          playAudio("success");
        } else {
          // FAIL — RED BLOCK SCREEN
          setScreenState("error");
          setLastMessage(`🚨 BLOCKED — ${failures.length} check(s) failed:\n${failures.join(" | ")}`);
          addToHistory(barcode, companyName, "error", `BLOCKED: ${failures.join("; ")}`);
          playAudio("error");

          await supabase.from("audit_logs").insert({
            action_type: "SECURITY_GATE_3POINT_FAIL",
            module_name: "SecurityGate",
            entity_name: "dispatch_cartons",
            entity_id: carton.id,
            actor_id: (await supabase.auth.getUser()).data.user?.id || null,
            reason: failures.join("; "),
            risk_level: "high",
            new_value: { check_status: check1, check_invoice: check2, check_eway: check3, order_value: orderValue } as any,
          });
        }
      }
    } catch (err) {
      setScreenState("error");
      setLastMessage("System Error. Please try again.");
    } finally {
      setIsProcessing(false);
      resetScreen();
    }
  };

  const addToHistory = (barcode: string, company: string, status: "success" | "error" | "duplicate", msg: string) => {
    setScanHistory((prev) =>
      [{ id: Math.random().toString(), barcode, company_name: company, status, message: msg, scanned_at: new Date() }, ...prev].slice(0, 10)
    );
  };

  const playAudio = (type: "success" | "error") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {}
  };

  // UI Theme based on state
  let bgClass = "bg-slate-900";
  let textClass = "text-slate-400";
  let Icon = ScanLine;
  if (screenState === "success") { bgClass = "bg-emerald-500"; textClass = "text-white"; Icon = ShieldCheck; }
  else if (screenState === "error" || screenState === "duplicate") { bgClass = "bg-red-600"; textClass = "text-white"; Icon = ShieldAlert; }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* TAB BAR */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("scanner")}
          className={`flex-1 py-3 text-center font-bold text-sm uppercase tracking-wider transition-colors ${
            activeTab === "scanner" ? "bg-slate-800 text-white border-b-2 border-emerald-500" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <ScanLine size={16} className="inline mr-2" /> Scan-Out
        </button>
        <button
          onClick={() => setActiveTab("inward")}
          className={`flex-1 py-3 text-center font-bold text-sm uppercase tracking-wider transition-colors ${
            activeTab === "inward" ? "bg-slate-800 text-white border-b-2 border-amber-500" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Truck size={16} className="inline mr-2" /> 🚛 Expected Arrivals
        </button>
      </div>

      {/* ═══════ SCANNER TAB (UNCHANGED) ═══════ */}
      {activeTab === "scanner" && (
        <div className="flex-1 flex flex-col lg:flex-row">
          <div className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-500 ${bgClass}`}>
            <div className={`mb-6 transition-all duration-300 ${textClass}`}>
              <Icon size={120} strokeWidth={1.5} />
            </div>
            <h1 className={`text-5xl md:text-7xl font-black tracking-tight mb-4 text-center transition-colors duration-300 ${textClass}`}>
              {screenState === "idle" && "SCAN CARTON"}
              {screenState === "success" && "AUTHORIZED"}
              {screenState === "error" && "🚨 CRITICAL ERROR"}
              {screenState === "duplicate" && "STOP! DUPLICATE"}
            </h1>
            <p className={`text-lg md:text-2xl font-medium text-center max-w-xl transition-colors duration-300 ${screenState === "idle" ? "text-slate-500" : "text-white/80"}`}>
              {lastMessage}
            </p>
            {screenState === "error" && (
              <button
                onClick={async () => {
                  await supabase.from("audit_logs").insert({
                    action_type: "GATE_INCIDENT_LOGGED",
                    module_name: "SecurityGate",
                    entity_name: "dispatch_cartons",
                    entity_id: inputValue || "manual",
                    reason: lastMessage,
                    risk_level: "high",
                  });
                  toast.success("🔴 Incident logged to audit trail");
                }}
                className="mt-6 px-8 py-4 bg-white text-red-600 rounded-2xl text-lg font-black uppercase tracking-wider hover:bg-red-50 border-2 border-white/50 animate-pulse"
              >
                ⚠️ LOG INCIDENT
              </button>
            )}
            <form onSubmit={handleScan} className="mt-10 w-full max-w-md">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Keyboard/Scanner Input..."
                className="w-full text-center py-4 bg-black/50 text-white border border-white/20 rounded-2xl font-mono text-xl outline-none focus:border-white"
                autoFocus
                autoComplete="off"
              />
            </form>
          </div>

          <div className="w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
            <div className="p-5 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <Shield size={20} className="text-slate-400" /> Gate Activity Log
              </div>
              <p className="text-xs text-slate-500 mt-1">Live exit history</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {scanHistory.length === 0 ? (
                <div className="text-center py-16 text-slate-600">
                  <Box size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No recent scans</p>
                </div>
              ) : (
                scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    className={`p-3 rounded-xl border ${
                      scan.status === "success" ? "bg-emerald-950/50 border-emerald-800"
                        : scan.status === "duplicate" ? "bg-amber-950/50 border-amber-800"
                        : "bg-red-950/50 border-red-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold uppercase ${
                        scan.status === "success" ? "text-emerald-400" : scan.status === "duplicate" ? "text-amber-400" : "text-red-400"
                      }`}>
                        {scan.status}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {scan.scanned_at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200">{scan.company_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{scan.barcode}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ INWARD TAB ═══════ */}
      {activeTab === "inward" && (
        <div className="flex-1 flex flex-col p-6">
          {/* Search */}
          <div className="relative max-w-md mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by company name..."
              className="w-full pl-10 pr-4 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500"
            />
          </div>

          {inwardLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
          ) : filteredAdvices.length === 0 ? (
            <div className="text-center py-20 text-slate-600">
              <Truck size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-semibold">No expected arrivals</p>
              <p className="text-sm mt-1">All clear at the gate.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAdvices.map((adv) => (
                <div key={adv.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">{adv.company_name}</h3>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold uppercase">Expected</span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="text-slate-400">
                      <span className="text-slate-500">Reason:</span> {adv.reason || "—"}
                    </p>
                    <p className="text-slate-400">
                      <span className="text-slate-500">Value:</span>{" "}
                      <span className="text-amber-400 font-mono font-bold">₹{(adv.expected_value || 0).toLocaleString("en-IN")}</span>
                    </p>
                    <p className="text-slate-400">
                      <span className="text-slate-500">Items:</span> {adv.item_count} product line(s)
                    </p>
                    <p className="text-slate-400">
                      <span className="text-slate-500">Docs:</span> {adv.accompanying_docs || "None"}
                    </p>
                    <p className="text-slate-400">
                      <span className="text-slate-500">Sales Exec:</span> {adv.sales_exec_name}
                    </p>
                    {adv.created_at && (
                      <p className="text-slate-500 text-xs">
                        Advised on {new Date(adv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={() => { setArrivalModal(adv); setBoxCount(""); }}
                    className="mt-auto w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    <CheckCircle size={16} /> Mark Arrived
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ ARRIVAL VERIFICATION MODAL ═══════ */}
      <Dialog open={!!arrivalModal} onOpenChange={(v) => !v && setArrivalModal(null)}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Truck size={20} className="text-amber-500" /> Verify Arrival
            </DialogTitle>
          </DialogHeader>
          {arrivalModal && (
            <div className="space-y-4 mt-2">
              <div className="bg-slate-800 rounded-xl p-4 space-y-1">
                <p className="font-bold text-lg">{arrivalModal.company_name}</p>
                <p className="text-slate-400 text-sm">Reason: {arrivalModal.reason}</p>
                <p className="text-amber-400 font-mono text-sm">
                  Expected Value: ₹{(arrivalModal.expected_value || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-slate-400 text-sm">
                  Expected Line Items: {arrivalModal.item_count}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-400 mb-1 block">Physical Box Count *</label>
                <Input
                  type="number"
                  min="0"
                  value={boxCount}
                  onChange={(e) => setBoxCount(e.target.value)}
                  placeholder="How many boxes arrived?"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <Button
                onClick={handleMarkArrived}
                disabled={markingSaving}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {markingSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                Confirm Arrival at Gate
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSecurityGate;
