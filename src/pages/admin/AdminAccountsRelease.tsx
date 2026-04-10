import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronDown, Check, Lock, Truck, X, IndianRupee, FileText, Upload, ShieldCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { queueNotification } from "@/utils/notificationOutbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FinanceOrder {
  id: string; status: string; payment_status: string | null;
  sales_order_value: number | null; advance_paid: number | null;
  advance_required: number | null; company_id: string | null;
  final_invoice_url?: string | null; eway_bill_number?: string | null;
  payment_cleared?: boolean | null;
  company?: { business_name: string; wallet_balance?: number | null } | null;
}

type PaymentAction = "request_advance" | "mark_advance_paid" | "request_balance" | "mark_fully_paid" | "issue_gate_pass";

const ACTION_LABELS: Record<PaymentAction, string> = {
  request_advance: "Request 50% Advance",
  mark_advance_paid: "Mark Advance Paid",
  request_balance: "Request Final Balance",
  mark_fully_paid: "Mark Fully Paid",
  issue_gate_pass: "Generate Shipping & Gate Pass",
};

function getAvailableActions(order: FinanceOrder): PaymentAction[] {
  const actions: PaymentAction[] = [];
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  if (advReq === 0) actions.push("request_advance");
  if (advReq > 0 && advPaid < advReq) actions.push("mark_advance_paid");
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

const AdminAccountsRelease = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "hold" | "overdue">("all");
  const { user } = useAuth();
  const { t } = useLanguage();
  const { format } = useCurrency();

  // Logistics handover state
  const [gatePassOrder, setGatePassOrder] = useState<FinanceOrder | null>(null);
  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [submittingGatePass, setSubmittingGatePass] = useState(false);
  const [agreedFreight, setAgreedFreight] = useState<string>("");
  const [freightAdvance, setFreightAdvance] = useState<string>("");

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
      .select("id, status, payment_status, sales_order_value, advance_paid, advance_required, company_id, final_invoice_url, eway_bill_number, payment_cleared, company:companies(business_name, wallet_balance)")
      .not("status", "in", '("draft","cart")')
      .order("created_at", { ascending: false });
    setOrders((data as unknown as FinanceOrder[]) ?? []);
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
  };

  const handleGatePassSubmit = async () => {
    if (!gatePassOrder) return;
    const freightAmt = parseFloat(agreedFreight);
    const freightAdv = parseFloat(freightAdvance);
    if (isNaN(freightAmt) || isNaN(freightAdv)) {
      toast.error("Freight amounts are required");
      return;
    }
    setSubmittingGatePass(true);
    try {
      const orderId = gatePassOrder.id;
      const companyId = gatePassOrder.company_id;

      // Fetch packed data for partial dispatch billing
      const { data: packedData } = await supabase
        .from("packing_lists")
        .select("product_id, packed_quantity")
        .eq("dispatch_id", orderId);
      
      // Store packed items for invoice generation
      const packedItems = (packedData || []).map((pl: any) => ({
        product_id: pl.product_id,
        packed_quantity: Number(pl.packed_quantity),
      }));

      // Insert dispatch record
      const { data: dispatchData, error: dispatchErr } = await supabase
        .from("dispatches")
        .insert({
          order_id: orderId,
          company_id: companyId,
          transporter_name: transporterName || null,
          tracking_number: trackingNumber || null,
          driver_phone: driverPhone || null,
          status: "dispatched",
          dispatch_date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (dispatchErr) throw dispatchErr;
      const dispatchId = dispatchData.id;

      // Estimate cartons
      const totalValue = gatePassOrder.sales_order_value ?? 0;
      const totalBoxes = Math.max(1, Math.ceil(totalValue / 5000));

      // Insert carton barcodes
      const cartonRows = Array.from({ length: totalBoxes }, (_, i) => ({
        order_id: orderId,
        dispatch_id: dispatchId,
        barcode_string: `OASIS-${orderId.slice(0, 8).toUpperCase()}-B${i + 1}`,
        box_number: i + 1,
        total_boxes: totalBoxes,
        status: "labeled",
      }));

      await supabase.from("dispatch_cartons").insert(cartonRows);

      // Insert freight ledger
      await supabase.from("freight_ledger").insert({
        order_id: orderId,
        transporter_name: transporterName || null,
        total_freight_amt: freightAmt,
        advance_paid_amt: freightAdv,
        balance_due_amt: freightAmt - freightAdv,
        payment_status: freightAdv >= freightAmt ? "paid" : "pending",
      });

      // ═══ WALLET ENGINE: SO vs DPL reconciliation ═══
      // Calculate actual packed value from packing list + product prices
      let dplValue = 0;
      if (packedItems.length > 0) {
        const productIds = packedItems.map((p: any) => p.product_id).filter(Boolean);
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from("products")
            .select("id, price_per_kg")
            .in("id", productIds);
          const priceMap: Record<string, number> = {};
          (products || []).forEach((p: any) => { priceMap[p.id] = Number(p.price_per_kg || 0); });
          dplValue = packedItems.reduce((sum: number, item: any) => sum + (item.packed_quantity * (priceMap[item.product_id] || 0)), 0);
        }
      }

      const soValue = gatePassOrder.sales_order_value ?? 0;
      const walletDiff = soValue - dplValue;

      if (walletDiff > 0 && companyId && dplValue > 0) {
        // DPL < SO → Credit client wallet
        await supabase.from("companies").update({
          wallet_balance: (await supabase.from("companies").select("wallet_balance").eq("id", companyId).single()).data?.wallet_balance
            ? Number((await supabase.from("companies").select("wallet_balance").eq("id", companyId).single()).data?.wallet_balance || 0) + walletDiff
            : walletDiff,
        }).eq("id", companyId);
        await supabase.from("audit_logs").insert({
          action_type: "wallet_credit_dpl_variance",
          module_name: "Finance",
          entity_name: "order",
          entity_id: orderId,
          actor_id: user?.id,
          new_value: { so_value: soValue, dpl_value: dplValue, credit_amount: walletDiff },
          risk_level: "high",
        });
      } else if (walletDiff < 0 && dplValue > 0) {
        // DPL > SO → Flag payment pending
        await supabase.from("orders").update({ payment_status: "balance_due" }).eq("id", orderId);
        await supabase.from("audit_logs").insert({
          action_type: "wallet_debit_dpl_variance",
          module_name: "Finance",
          entity_name: "order",
          entity_id: orderId,
          actor_id: user?.id,
          new_value: { so_value: soValue, dpl_value: dplValue, debit_amount: Math.abs(walletDiff) },
          risk_level: "high",
        });
      }

      // Update order status
      await supabase.from("orders").update({ status: "dispatched" }).eq("id", orderId);
      await supabase.from("order_status_history").insert({
        order_id: orderId,
        old_status: gatePassOrder.status,
        new_status: "dispatched",
      });
      await supabase.from("audit_logs").insert({
        action_type: "finance_issue_gate_pass",
        module_name: "Finance",
        entity_name: "order",
        entity_id: orderId,
        actor_id: user?.id,
        new_value: {
          packed_items: packedItems,
          packed_items_count: packedItems.length,
          note: "Packed data passed to invoice generator for partial dispatch billing",
        },
      });

      // Template-driven Logistics Notification
      const triggerClientNotification = async (oid: string, trackingInfo: { lr_number: string; transporter: string }) => {
        const { data: evt } = await supabase
          .from("notification_events")
          .select("is_enabled, template_body")
          .eq("event_key", "order_dispatched")
          .single();

        let generatedMessage: string | null = null;
        if (evt?.is_enabled) {
          generatedMessage = (evt.template_body || "")
            .replace(/\{\{order_id\}\}/g, oid.slice(0, 8).toUpperCase())
            .replace(/\{\{transporter\}\}/g, trackingInfo.transporter)
            .replace(/\{\{lr_number\}\}/g, trackingInfo.lr_number);
        }

        await supabase.from("audit_logs").insert({
          action_type: "client_shipping_notified",
          module_name: "Logistics",
          entity_name: "order",
          entity_id: oid,
          actor_id: user?.id,
          new_value: {
            lr_number: trackingInfo.lr_number,
            transporter: trackingInfo.transporter,
            notified_at: new Date().toISOString(),
            notification_enabled: evt?.is_enabled ?? false,
            generated_message: generatedMessage,
          },
        });

        // Queue to outbox for actual delivery
        if (generatedMessage) {
          // Try to get company contact phone
          const order = orders.find(o => o.id === oid);
          let recipientPhone: string | null = null;
          if (order?.company_id) {
            const { data: compData } = await supabase
              .from("b2b_applications")
              .select("contact_phone")
              .eq("user_id", order.company_id)
              .maybeSingle();
            recipientPhone = compData?.contact_phone || null;
          }
          await queueNotification({
            eventType: "order_dispatched",
            messageBody: generatedMessage,
            recipientPhone,
            priority: "normal",
          });
        }
      };
      await triggerClientNotification(orderId, {
        lr_number: trackingNumber || "N/A",
        transporter: transporterName || "N/A",
      });

      toast.success(`Gate Pass issued — ${totalBoxes} carton barcode(s) pushed to Security Gate`);
      setGatePassOrder(null);
      fetchOrders();
    } catch {
      toast.error("Failed to issue gate pass");
    }
    setSubmittingGatePass(false);
  };

  const handleAction = async (order: FinanceOrder, action: PaymentAction) => {
    if (action === "issue_gate_pass") {
      openGatePassModal(order);
      setOpenDropdown(null);
      return;
    }
    setActing(order.id); setOpenDropdown(null);
    const total = order.sales_order_value ?? 0;
    const advPaid = order.advance_paid ?? 0;
    try {
      if (action === "request_advance") {
        const amt = Math.round(total * 0.5);
        await supabase.from("orders").update({ advance_required: amt }).eq("id", order.id);
        toast.success(`50% advance of ${format(amt)} requested`);
      } else if (action === "mark_advance_paid") {
        const advReq = order.advance_required ?? 0;
        await supabase.from("order_payments").insert({ order_id: order.id, company_id: order.company_id, payment_type: "advance", amount: advReq, created_by: user?.id ?? null });
        await supabase.from("orders").update({ advance_paid: advReq, status: "manufacturing", payment_status: "advance_paid" }).eq("id", order.id);
        await supabase.from("order_status_history").insert({ order_id: order.id, old_status: order.status, new_status: "manufacturing" });
        toast.success("Advance paid — released to Production");
      } else if (action === "request_balance") {
        toast.success(`Balance of ${format(total - advPaid)} requested`);
      } else if (action === "mark_fully_paid") {
        const due = total - advPaid;
        await supabase.from("order_payments").insert({ order_id: order.id, company_id: order.company_id, payment_type: "balance", amount: due, created_by: user?.id ?? null });
        await supabase.from("orders").update({ payment_status: "paid", closed_at: new Date().toISOString() }).eq("id", order.id);
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
      const walletBalance = (order.company as any)?.wallet_balance ?? 0;
      const walletDiff = walletBalance - piTotal;

      if (walletDiff >= 0 && order.company_id) {
        // Auto-deduct from wallet
        await supabase.from("companies").update({ wallet_balance: walletDiff }).eq("id", order.company_id);
        await supabase.from("orders").update({ payment_cleared: true, payment_status: "paid", document_stage: "PI" }).eq("id", order.id);
        await supabase.from("audit_logs").insert({
          action_type: "PI_WALLET_AUTO_DEDUCT", module_name: "Finance",
          entity_name: "orders", entity_id: order.id, actor_id: user?.id,
          new_value: { pi_total: piTotal, wallet_before: walletBalance, wallet_after: walletDiff } as any,
          risk_level: "normal",
        });
        toast.success(`PI Generated — ₹${piTotal.toLocaleString("en-IN")} auto-deducted from wallet`);
      } else {
        // Payment pending
        await supabase.from("orders").update({ payment_status: "balance_due", document_stage: "PI" }).eq("id", order.id);
        toast.warning(`PI Generated — Payment Pending: ₹${Math.abs(walletDiff).toLocaleString("en-IN")}`);
      }
      await supabase.from("order_status_history").insert({ order_id: order.id, old_status: order.status, new_status: "awaiting_payment" });
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
    await supabase.from("orders").update({ status: "cleared_for_dispatch" }).eq("id", order.id);
    await supabase.from("order_status_history").insert({ order_id: order.id, old_status: order.status, new_status: "cleared_for_dispatch" });
    await supabase.from("audit_logs").insert({
      action_type: "MASTER_BARCODE_RELEASED", module_name: "Finance",
      entity_name: "orders", entity_id: order.id, actor_id: user?.id,
      risk_level: "normal",
    });
    toast.success("Master Barcode Released — Order cleared for dispatch");
    fetchOrders();
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
                return (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{order.company?.business_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground text-xs">{order.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${rl.color}`}>{rl.label}</span></td>
                    <td className="px-4 py-3 text-right text-ui-cell text-muted-foreground">{format(order.advance_required ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-cell text-green-600">{format(order.advance_paid ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-cell text-foreground">{format(order.sales_order_value ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-primary">{format(due)}</td>
                    <td className="px-4 py-3 text-right">
                      {actions.length > 0 ? (
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
                      ) : (
                        <span className="text-ui-label text-muted-foreground flex items-center gap-1 justify-end"><Check size={14} /> Paid</span>
                      )}
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

          <div className="space-y-4 pt-2">
            {/* Logistics Inputs */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="gp-transporter">Transporter Name</Label>
                <Input id="gp-transporter" placeholder="e.g. BlueDart, DTDC" value={transporterName} onChange={e => setTransporterName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gp-tracking">LR / Bilty Number</Label>
                <Input id="gp-tracking" placeholder="Tracking / LR number" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="gp-driver">Driver Phone</Label>
                <Input id="gp-driver" placeholder="+91 XXXXX XXXXX" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} />
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

            {/* Document Print Actions */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shipping Documents</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => toast.info("Consignee Sticker print — coming soon")}
                  className="px-3 py-2 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors text-center">
                  Consignee Sticker
                </button>
                <button onClick={() => toast.info("Packing List print — coming soon")}
                  className="px-3 py-2 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors text-center">
                  Packing List
                </button>
                <button onClick={() => toast.info("Export Invoice print — coming soon")}
                  className="px-3 py-2 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors text-center">
                  Export Invoice
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
    </div>
  );
};

export default AdminAccountsRelease;
