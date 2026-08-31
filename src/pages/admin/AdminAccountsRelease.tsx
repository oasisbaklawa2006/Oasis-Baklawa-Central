import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, ChevronDown, Check, Lock, Truck, X, IndianRupee, FileText, Upload, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { sendWhatsAppMessage } from "@/utils/whatsapp";
import { blockLegacyB2bCartonDplMutation } from "@/lib/dispatch-finalization/legacyDispatchGuard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FinanceReleaseChips } from "@/components/admin/FinanceReleaseChips";
import {
  clearOrderForDispatch,
  recordOrderFullyPaid,
} from "@/lib/order-authority/orderAuthorityClient";
import {
  isWalletPiAutoSettleEligible,
  WALLET_PI_FAIL_CLOSED_MESSAGE,
} from "@/utils/walletPiSettlement";
import {
  canReleaseOrderToDispatch,
  deriveFinanceReleaseState,
  getFinanceReleaseBlockers,
} from "@/utils/financeReleaseState";
import { getWalletBalance } from "@/lib/order-authority/creditWalletAuthorityClient";

type FinanceOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "status" | "payment_status" | "sales_order_value" | "advance_paid" | "advance_required" |
    "company_id" | "final_invoice_url" | "eway_bill_number" | "payment_cleared"
> & { company?: { business_name: string; wallet_balance?: number | null } | null };

type PaymentAction = "request_advance" | "request_balance" | "mark_fully_paid" | "issue_gate_pass";

const ACTION_LABELS: Record<PaymentAction, string> = {
  request_advance: "Request 50% Advance",
  request_balance: "Request Final Balance",
  mark_fully_paid: "Mark Fully Paid",
  issue_gate_pass: "Generate Shipping & Gate Pass",
};

function getAvailableActions(order: FinanceOrder): PaymentAction[] {
  const actions: PaymentAction[] = [];
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  if (advReq === 0) actions.push("request_advance");
  if (advPaid >= advReq && advReq > 0 && order.payment_status !== "paid") actions.push("request_balance");
  if (order.payment_status !== "paid" && advPaid > 0) actions.push("mark_fully_paid");

  // Gate pass: available when financially cleared AND physically ready
  const rs = getReleaseStatus(order);
  if ((rs === "paid" || rs === "cleared") && ["packed_ready", "cleared_for_dispatch"].includes(order.status)) {
    actions.push("issue_gate_pass");
  }

  return actions;
}

type ReleaseStatus = "advance_pending" | "balance_pending" | "finance_hold" | "cleared" | "paid";

function getReleaseStatus(order: FinanceOrder): ReleaseStatus {
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  const total = order.sales_order_value ?? 0;
  if (order.payment_status === "paid") return "paid";
  if (advReq === 0) return "advance_pending";
  if (advPaid < advReq) return "finance_hold";
  if (advPaid >= advReq && (total - advPaid) > 0) return "balance_pending";
  return "cleared";
}

const RELEASE_LABELS: Record<ReleaseStatus, { label: string; color: string }> = {
  advance_pending: { label: "Advance Pending", color: "bg-amber-100 text-amber-700" },
  balance_pending: { label: "Balance Pending", color: "bg-blue-100 text-blue-700" },
  finance_hold: { label: "Finance Hold", color: "bg-destructive/10 text-destructive" },
  cleared: { label: "Cleared", color: "bg-green-100 text-green-700" },
  paid: { label: "Fully Paid", color: "bg-green-100 text-green-700" },
};

function financeTraceInput(order: FinanceOrder) {
  return {
    status: order.status,
    payment_status: order.payment_status,
    advance_paid: order.advance_paid,
    advance_required: order.advance_required,
    sales_order_value: order.sales_order_value,
  };
}

const AdminAccountsRelease = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "hold" | "overdue" | "awaiting">("all");
  const { user } = useAuth();
  const { t } = useLanguage();
  const { format } = useCurrency();
  const navigate = useNavigate();

  // Logistics handover state
  const [gatePassOrder, setGatePassOrder] = useState<FinanceOrder | null>(null);
  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [submittingGatePass, setSubmittingGatePass] = useState(false);
  const [agreedFreight, setAgreedFreight] = useState<string>("");
  const [freightAdvance, setFreightAdvance] = useState<string>("");
  const [gatePassProofFile, setGatePassProofFile] = useState<File | null>(null);

  // Document upload state
  const [docUploadOrder, setDocUploadOrder] = useState<FinanceOrder | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingEway, setUploadingEway] = useState(false);

  // PI generation state
  const [generatingPi, setGeneratingPi] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, status, payment_status, sales_order_value, advance_paid, advance_required, company_id, final_invoice_url, eway_bill_number, payment_cleared, company:companies(business_name)")
      .not("status", "in", '("draft","cart")')
      .order("created_at", { ascending: false });
    const rows: FinanceOrder[] = data ?? [];
    const enriched = await Promise.all(rows.map(async (order) => {
      if (!order.company_id || !order.company) return order;
      try {
        return { ...order, company: { ...order.company, wallet_balance: await getWalletBalance(order.company_id) } };
      } catch {
        // PF-6B is fail-closed: do not turn an unavailable Core balance into ₹0.
        return { ...order, company: { ...order.company, wallet_balance: null } };
      }
    }));
    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const openGatePassModal = (order: FinanceOrder) => {
    setGatePassOrder(order);
    setTransporterName("");
    setTrackingNumber("");
    setDriverPhone("");
    setAgreedFreight("");
    setFreightAdvance("");
    setGatePassProofFile(null);
  };

  const handleGatePassSubmit = async () => {
    if (!gatePassOrder) return;
    // FACT-C3: gate-pass carton/dispatch/DPL creation here is a legacy B2B
    // authority competing with the governed DispatchManagement
    // consignment/carton/DPL chain -- fail closed before any legacy write
    // (dispatches, dispatch_cartons, freight_ledger, wallet) can run. This
    // is the first check, not the last: no finance/transporter/freight
    // validation matters when submission can never persist anything.
    const block = blockLegacyB2bCartonDplMutation("AdminAccountsRelease.handleGatePassSubmit");
    toast.error(block.message, {
      description: "Use governed Dispatch Management to create the consignment, cartons and packing list, then return here for Finance release.",
      action: {
        label: "Open Dispatch Management",
        onClick: () => navigate(block.route),
      },
    });
  };

  const handleAction = async (order: FinanceOrder, action: PaymentAction) => {
    if (action === "issue_gate_pass") {
      const traceIn = financeTraceInput(order);
      if (!canReleaseOrderToDispatch(traceIn)) {
        toast.error(getFinanceReleaseBlockers(traceIn).map((b) => b.message).join("; "));
        setOpenDropdown(null);
        return;
      }
      openGatePassModal(order);
      setOpenDropdown(null);
      return;
    }
    setActing(order.id); setOpenDropdown(null);
    const total = order.sales_order_value ?? 0;
    const advPaid = order.advance_paid ?? 0;
    try {
      if (action === "request_advance") {
        toast.error("Setting advance requirement requires a governed finance RPC — use Finance Release Board.");
        setActing(null);
        return;
      } else if (action === "request_balance") {
        toast.success(`Balance of ${format(total - advPaid)} requested`);
      } else if (action === "mark_fully_paid") {
        await recordOrderFullyPaid(order.id);
        toast.success("Fully paid");
      }
      await supabase.from("audit_logs").insert({ action_type: `finance_${action}`, module_name: "Finance", entity_name: "order", entity_id: order.id, actor_id: user?.id });
      fetchOrders();
    } catch { toast.error("Action failed"); }
    setActing(null);
  };

  // ═══ PI GENERATION & WALLET ENGINE ═══
  const handleGeneratePI = async (order: FinanceOrder) => {
    setGeneratingPi(order.id);
    try {
      const piTotal = order.sales_order_value ?? 0;
      const walletBalance = order.company?.wallet_balance;
      if (walletBalance == null) throw new Error("Canonical Core wallet balance unavailable; PI wallet assessment is blocked.");
      const walletDiff = walletBalance - piTotal;

      if (isWalletPiAutoSettleEligible(walletBalance, piTotal) && order.company_id) {
        toast.error(WALLET_PI_FAIL_CLOSED_MESSAGE);
      } else {
        // Payment pending
        const balanceDue = Math.abs(walletDiff);
        toast.warning(`PI wallet shortfall ₹${balanceDue.toLocaleString("en-IN")} — use Finance Release Board to record payment.`);

        // Auto-send WhatsApp PI notification to client
        if (order.company_id) {
          const { data: appData } = await supabase.from("b2b_applications").select("contact_phone, mobile_number").eq("status", "approved").limit(1);
          const phone = appData?.[0]?.mobile_number || appData?.[0]?.contact_phone;
          if (phone) {
            sendWhatsAppMessage({
              to: phone,
              message: `💰 Payment Request — Oasis Baklawa\n\nDear ${order.company?.business_name || "Customer"},\nOrder ${order.id.slice(0, 8).toUpperCase()}: Balance Due ₹${balanceDue.toLocaleString("en-IN")}.\n\nPlease clear payment to release dispatch.\n— Team Oasis Baklawa`,
              companyId: order.company_id,
              orderId: order.id,
            }).catch(console.error);
          }
        }
      }
      fetchOrders();
    } catch { toast.error("PI generation failed"); }
    setGeneratingPi(null);
  };

  // ═══ DOCUMENT UPLOAD HANDLERS ═══
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docUploadOrder) return;
    setUploadingInvoice(true);
    const path = `final-invoices/${docUploadOrder.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("final-invoices").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploadingInvoice(false); return; }
    const { data: urlData } = supabase.storage.from("final-invoices").getPublicUrl(path);
    await supabase.from("orders").update({ final_invoice_url: urlData.publicUrl }).eq("id", docUploadOrder.id);
    toast.success("Tax Invoice uploaded");
    setUploadingInvoice(false);
    fetchOrders();
  };

  const handleEwayUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docUploadOrder) return;
    setUploadingEway(true);
    const ewayRef = `EWAY-${docUploadOrder.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
    await supabase.from("orders").update({ eway_bill_number: ewayRef, eway_bill_url: URL.createObjectURL(file) }).eq("id", docUploadOrder.id);
    toast.success("E-Way Bill uploaded");
    setUploadingEway(false);
    fetchOrders();
  };

  const canReleaseMasterBarcode = (order: FinanceOrder) => {
    return order.payment_cleared === true && !!order.final_invoice_url;
  };

  const handleReleaseMasterBarcode = async (order: FinanceOrder) => {
    const trace = financeTraceInput(order);
    if (!canReleaseOrderToDispatch(trace)) {
      toast.error(getFinanceReleaseBlockers(trace).map((b) => b.message).join("; "));
      return;
    }
    try {
      await clearOrderForDispatch(order.id);
      toast.success("Master Barcode Released — Order cleared for dispatch");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dispatch clearance denied");
    }
  };

  // Summary counts
  const awaitingFinanceOrders = orders.filter(o => o.status === "awaiting_payment" || o.status === "awaiting_final_payment");
  const holdCount = orders.filter(o => getReleaseStatus(o) === "finance_hold").length;
  const advPendingCount = orders.filter(o => getReleaseStatus(o) === "advance_pending").length;
  const balPendingCount = orders.filter(o => getReleaseStatus(o) === "balance_pending").length;
  const totalDue = orders.reduce((s, o) => s + ((o.sales_order_value ?? 0) - (o.advance_paid ?? 0)), 0);
  const dispatchBlocked = orders.filter(o => ["cleared_for_dispatch", "packed_ready"].includes(o.status) && getReleaseStatus(o) === "finance_hold").length;

  const filtered = tab === "hold" ? orders.filter(o => getReleaseStatus(o) === "finance_hold")
    : tab === "overdue" ? orders.filter(o => getReleaseStatus(o) === "balance_pending")
    : tab === "awaiting" ? awaitingFinanceOrders
    : orders;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  const gateFinanceTrace = gatePassOrder ? financeTraceInput(gatePassOrder) : null;
  const gateFinState = gateFinanceTrace ? deriveFinanceReleaseState(gateFinanceTrace) : null;
  const gateFinBlockers = gateFinanceTrace ? getFinanceReleaseBlockers(gateFinanceTrace) : [];

  const docFinanceTrace = docUploadOrder ? financeTraceInput(docUploadOrder) : null;
  const docFinState = docFinanceTrace ? deriveFinanceReleaseState(docFinanceTrace) : null;
  const docFinBlockers = docFinanceTrace ? getFinanceReleaseBlockers(docFinanceTrace) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">{t("Accounts & Release")}</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Advance Pending", value: advPendingCount, color: "text-amber-600" },
          { label: "Balance Pending", value: balPendingCount, color: "text-blue-600" },
          { label: "Finance Hold", value: holdCount, color: "text-destructive" },
          { label: "Dispatch Blocked", value: dispatchBlocked, color: "text-destructive" },
          { label: "Total Outstanding", value: format(totalDue), color: "text-primary" },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <p className={`text-ui-kpi text-lg ${m.color}`}>{m.value}</p>
            <p className="text-fine text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "all" as const, label: "All Orders", count: orders.length },
          { key: "awaiting" as const, label: "Awaiting Finance", count: awaitingFinanceOrders.length },
          { key: "hold" as const, label: "Finance Hold", count: holdCount },
          { key: "overdue" as const, label: "Balance Due", count: balPendingCount },
        ].map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-lg text-ui-button transition-colors ${tab === tb.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {tb.label} ({tb.count})
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No pending payments.</p>
      ) : (
        <div className="rounded-xl overflow-visible border border-border bg-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">{t("Company")}</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Release Status</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground min-w-[200px]">Finance release</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Advance Required")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Advance Paid")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Sales Order Value")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Balance Due")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const due = (order.sales_order_value ?? 0) - (order.advance_paid ?? 0);
                const rs = getReleaseStatus(order);
                const rl = RELEASE_LABELS[rs];
                const actions = getAvailableActions(order);
                const traceIn = financeTraceInput(order);
                const finState = deriveFinanceReleaseState(traceIn);
                const finBlockers = getFinanceReleaseBlockers(traceIn);
                return (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{order.company?.business_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground text-xs">{order.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${rl.color}`}>{rl.label}</span></td>
                    <td className="px-4 py-3 align-top min-w-[200px] max-w-[280px]">
                      <FinanceReleaseChips variant="compact" state={finState} />
                      {finState.finance_hold && finBlockers.length > 0 && (
                        <p className="mt-1.5 text-[10px] leading-snug text-destructive font-medium">
                          {finBlockers.map((b) => b.message).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-ui-cell text-muted-foreground">{format(order.advance_required ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-cell text-green-600">{format(order.advance_paid ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-cell text-foreground">{format(order.sales_order_value ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-primary">{format(due)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        {/* PI Generation for awaiting_payment orders */}
                        {(order.status === "awaiting_payment" || order.status === "awaiting_final_payment") && !order.payment_cleared && (
                          <button onClick={() => handleGeneratePI(order)} disabled={generatingPi === order.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 disabled:opacity-50">
                            {generatingPi === order.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Generate PI
                          </button>
                        )}

                        {/* Wallet deficit alert */}
                        {(order.status === "awaiting_payment" || order.status === "awaiting_final_payment") && !order.payment_cleared && (
                          (() => {
                            const walletBal = order.company?.wallet_balance;
                            const piTotal = order.sales_order_value ?? 0;
                            if (walletBal == null) {
                              return <Badge variant="destructive" className="text-[10px]">Wallet unavailable — Core facts required</Badge>;
                            }
                            const deficit = piTotal - walletBal;
                            return deficit > 0 ? (
                              <Badge variant="destructive" className="text-[10px]">
                                <AlertTriangle size={10} className="mr-1" /> Pending: ₹{deficit.toLocaleString("en-IN")}
                              </Badge>
                            ) : null;
                          })()
                        )}

                        {/* Document Upload */}
                        {order.payment_cleared && !order.final_invoice_url && (
                          <button onClick={() => setDocUploadOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                            <Upload size={12} /> Upload Docs
                          </button>
                        )}

                        {/* Release Master Barcode - HIDDEN until payment cleared AND invoice uploaded */}
                        {canReleaseMasterBarcode(order) && order.status !== "cleared_for_dispatch" && order.status !== "dispatched" && (
                          <button onClick={() => handleReleaseMasterBarcode(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                            <ShieldCheck size={12} /> Release Barcode
                          </button>
                        )}

                        {/* Existing action dropdown */}
                        {actions.length > 0 && (
                          <div className="relative inline-block">
                            <button onClick={() => setOpenDropdown(openDropdown === order.id ? null : order.id)} disabled={acting === order.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50">
                              {acting === order.id ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} {t("Actions")}
                            </button>
                            {openDropdown === order.id && (
                              <div className="absolute right-0 top-full mt-1 w-56 bg-card rounded-xl shadow-lg border border-border py-1 z-50">
                                {actions.map(a => (
                                  <button key={a} onClick={() => handleAction(order, a)}
                                    className={`w-full text-left px-4 py-2.5 text-sm font-ui text-foreground hover:bg-muted transition-colors flex items-center gap-2 ${a === "issue_gate_pass" ? "text-primary font-semibold" : ""}`}>
                                    {a === "issue_gate_pass" && <Truck size={14} />}
                                    {ACTION_LABELS[a]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {actions.length === 0 && order.payment_status === "paid" && (
                          <span className="text-ui-label text-muted-foreground flex items-center gap-1"><Check size={14} /> Paid</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Gate Pass / Logistics Handover Modal */}
      <Dialog open={!!gatePassOrder} onOpenChange={(open) => { if (!open) setGatePassOrder(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck size={20} className="text-primary" />
              Issue Gate Pass & Shipping
            </DialogTitle>
            <DialogDescription>
              Order {gatePassOrder?.id.slice(0, 8)}… — {gatePassOrder?.company?.business_name ?? "Unknown"}
            </DialogDescription>
          </DialogHeader>

          {gatePassOrder && gateFinState && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Finance release</p>
              <FinanceReleaseChips variant="compact" state={gateFinState} />
              {gateFinState.finance_hold && gateFinBlockers.length > 0 && (
                <p className="text-[10px] leading-snug text-destructive">
                  {gateFinBlockers.map((b) => b.message).join(" · ")}
                </p>
              )}
            </div>
          )}

          <div className="space-y-4 pt-2">
            {/* Logistics Inputs */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="gp-transporter">Transporter Name *</Label>
                <Input id="gp-transporter" placeholder="e.g. BlueDart, DTDC" value={transporterName} onChange={e => setTransporterName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gp-tracking">LR / Bilty / AWB *</Label>
                <Input id="gp-tracking" placeholder="Consignment reference" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gp-driver">Driver Phone</Label>
                <Input id="gp-driver" placeholder="+91 XXXXX XXXXX" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gp-proof">Dispatch proof (PDF / image) *</Label>
                <Input
                  id="gp-proof"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="cursor-pointer"
                  onChange={(e) => setGatePassProofFile(e.target.files?.[0] ?? null)}
                />
                {gatePassProofFile && <p className="text-xs text-muted-foreground">{gatePassProofFile.name}</p>}
              </div>
            </div>

            {/* Freight Financial Checkpoint */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee size={12} /> Freight Financial Checkpoint
              </p>
              <div>
                <Label htmlFor="gp-freight">Agreed Freight Amount (₹) *</Label>
                <Input id="gp-freight" type="number" min="0" placeholder="0" value={agreedFreight} onChange={e => setAgreedFreight(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gp-freight-adv">Freight Advance Paid (₹) *</Label>
                <Input id="gp-freight-adv" type="number" min="0" placeholder="0" value={freightAdvance} onChange={e => setFreightAdvance(e.target.value)} />
              </div>
            </div>

            {/* Document Print Actions — not yet enabled, buttons stay disabled until wired */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shipping Documents</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled
                  title="Consignee Sticker printing is not enabled yet"
                  className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium text-center cursor-not-allowed opacity-60">
                  Print unavailable — Consignee Sticker
                </button>
                <button
                  disabled
                  title="Packing List printing is not enabled yet"
                  className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium text-center cursor-not-allowed opacity-60">
                  Print unavailable — Packing List
                </button>
                <button
                  disabled
                  title="Export Invoice printing is not enabled yet"
                  className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium text-center cursor-not-allowed opacity-60">
                  Print unavailable — Export Invoice
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleGatePassSubmit}
              disabled={submittingGatePass}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submittingGatePass ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
              Issue Gate Pass & Push to Security
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Upload Modal */}
      <Dialog open={!!docUploadOrder} onOpenChange={(open) => { if (!open) setDocUploadOrder(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Upload Documents
            </DialogTitle>
            <DialogDescription>
              Order {docUploadOrder?.id.slice(0, 8)}… — {docUploadOrder?.company?.business_name ?? "Unknown"}
            </DialogDescription>
          </DialogHeader>

          {docUploadOrder && docFinState && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Finance release</p>
              <FinanceReleaseChips variant="compact" state={docFinState} />
              {docFinState.finance_hold && docFinBlockers.length > 0 && (
                <p className="text-[10px] leading-snug text-destructive">
                  {docFinBlockers.map((b) => b.message).join(" · ")}
                </p>
              )}
            </div>
          )}

          <div className="space-y-4 pt-2">
            {/* Tax Invoice Upload */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final Tax Invoice *</p>
              {docUploadOrder?.final_invoice_url ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 size={14} /> Invoice Uploaded
                </div>
              ) : (
                <label className="block">
                  <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={handleInvoiceUpload} />
                  <Button variant="outline" size="sm" className="w-full" asChild disabled={uploadingInvoice}>
                    <span>{uploadingInvoice ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />} Upload Invoice PDF</span>
                  </Button>
                </label>
              )}
            </div>

            {/* E-Way Bill Upload */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                E-Way Bill {(docUploadOrder?.sales_order_value ?? 0) > 50000 ? "(Required)" : "(Optional)"}
              </p>
              {docUploadOrder?.eway_bill_number ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 size={14} /> E-Way Bill: {docUploadOrder.eway_bill_number}
                </div>
              ) : (
                <label className="block">
                  <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={handleEwayUpload} />
                  <Button variant="outline" size="sm" className="w-full" asChild disabled={uploadingEway}>
                    <span>{uploadingEway ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />} Upload E-Way Bill</span>
                  </Button>
                </label>
              )}
            </div>

            {/* Release Gate */}
            {docUploadOrder && canReleaseMasterBarcode(docUploadOrder) ? (
              <Button className="w-full" onClick={() => { handleReleaseMasterBarcode(docUploadOrder); setDocUploadOrder(null); }}>
                <ShieldCheck size={16} className="mr-2" /> Release Master Barcode
              </Button>
            ) : (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-center">
                <p className="text-xs font-semibold text-destructive">
                  <Lock size={12} className="inline mr-1" /> Master Barcode LOCKED — Upload all required documents and clear payment first
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAccountsRelease;
