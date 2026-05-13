import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRight, Truck, PackageCheck, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/hooks/useLanguage";
import { notifyOrderDispatched } from "@/utils/notifyEvent";
import { getPackedReadyBlockers } from "@/utils/packedReadyGate";
import {
  canReleaseOrderToDispatch,
  deriveFinanceReleaseState,
  getFinanceReleaseBlockers,
} from "@/utils/financeReleaseState";
import { FinanceReleaseChips } from "@/components/admin/FinanceReleaseChips";

const PACKS_PER_CARTON = 9;

type StoreReqRow = {
  order_id: string;
  status: string | null;
  store_requisition_items?: { requested_qty: number; fulfilled_qty: number | null }[];
};

interface OrderItem {
  id: string; quantity: number; pack_size: string | null;
  carton_type: string | null; product_id: string | null;
  actual_packed_qty?: number | null;
  production_status?: string | null;
  product?: { name: string; price_per_kg: number | null; primary_pack_weight_kg: number; base_price: number | null } | null;
}

interface DispatchOrder {
  id: string; status: string; sales_order_value: number | null;
  payment_status: string | null; advance_paid: number | null; advance_required: number | null;
  company_id: string | null; company?: { business_name: string } | null;
  order_items?: OrderItem[];
}

interface ModalItem extends OrderItem {
  packed_qty: number;
  final_weight_kg: number;
  original_weight_kg: number;
  unit_price: number;
  original_line_total: number;
  final_line_total: number;
}

const AdminPackingDispatch = () => {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"packing" | "dispatch_ready" | "blocked">("packing");
  const [updating, setUpdating] = useState<string | null>(null);
  const { t } = useLanguage();

  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [modalItems, setModalItems] = useState<ModalItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [partialDispatch, setPartialDispatch] = useState(false);
  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [dispatchProofFile, setDispatchProofFile] = useState<File | null>(null);
  const [requisitionsByOrder, setRequisitionsByOrder] = useState<Record<string, StoreReqRow[]>>({});

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, status, sales_order_value, payment_status, advance_paid, advance_required, company_id, company:companies(business_name), order_items(id, quantity, actual_packed_qty, production_status, pack_size, carton_type, product_id)")
      .in("status", ["packed_ready", "cleared_for_dispatch"])
      .order("created_at", { ascending: true });
    const rows = (data as unknown as DispatchOrder[]) ?? [];
    setOrders(rows);
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      setRequisitionsByOrder({});
    } else {
      const { data: reqs } = await supabase
        .from("store_requisitions")
        .select("order_id, status, store_requisition_items(requested_qty, fulfilled_qty)")
        .in("order_id", ids);
      const map: Record<string, StoreReqRow[]> = {};
      for (const r of (reqs as StoreReqRow[]) || []) {
        const oid = r.order_id;
        if (!map[oid]) map[oid] = [];
        map[oid].push(r);
      }
      setRequisitionsByOrder(map);
    }
    setLoading(false);
  };

  const packedReadyChecksByOrder = useMemo(() => {
    const m: Record<string, ReturnType<typeof getPackedReadyBlockers>> = {};
    for (const o of orders) {
      const items = (o.order_items || []).map((it) => ({
        quantity: it.quantity,
        actual_packed_qty: it.actual_packed_qty ?? null,
        production_status: it.production_status ?? null,
      }));
      m[o.id] = getPackedReadyBlockers(
        {
          order: {
            status: o.status,
            payment_status: o.payment_status,
            advance_paid: o.advance_paid,
            advance_required: o.advance_required,
            sales_order_value: o.sales_order_value,
          },
          items,
          requisitions: requisitionsByOrder[o.id] || [],
        },
        { mode: "snapshot" },
      );
    }
    return m;
  }, [orders, requisitionsByOrder]);

  useEffect(() => { fetchOrders(); }, []);

  const isDispatchFinanceBlocked = (o: DispatchOrder) => !canReleaseOrderToDispatch({
    status: o.status,
    payment_status: o.payment_status,
    advance_paid: o.advance_paid,
    advance_required: o.advance_required,
    sales_order_value: o.sales_order_value,
  });

  const packingOrders = orders.filter(o => o.status === "packed_ready");
  const dispatchReady = orders.filter(o => o.status === "cleared_for_dispatch" && !isDispatchFinanceBlocked(o));
  const blockedOrders = orders.filter(o => isDispatchFinanceBlocked(o));
  const displayed = tab === "packing" ? packingOrders : tab === "dispatch_ready" ? dispatchReady : blockedOrders;

  const handleAdvanceToPacking = async (order: DispatchOrder) => {
    setUpdating(order.id);
    await supabase.from("orders").update({ status: "cleared_for_dispatch" }).eq("id", order.id);
    await supabase.from("order_status_history").insert({ order_id: order.id, old_status: "packed_ready", new_status: "cleared_for_dispatch" });
    toast.success(`Moved to ${t("Dispatch Ready")}`);
    setUpdating(null);
    fetchOrders();
  };

  const openDispatchModal = async (order: DispatchOrder) => {
    const traceInput = {
      status: order.status,
      payment_status: order.payment_status,
      advance_paid: order.advance_paid,
      advance_required: order.advance_required,
      sales_order_value: order.sales_order_value,
    };
    if (!canReleaseOrderToDispatch(traceInput)) {
      toast.error(getFinanceReleaseBlockers(traceInput).map((b) => b.message).join("; "));
      return;
    }
    setSelectedOrder(order);
    setTransporterName(""); setTrackingNumber(""); setDriverName(""); setDriverPhone("");
    setDispatchProofFile(null);
    setPartialDispatch(false); setShowSuccess(false); setModalLoading(true);

    const { data } = await supabase.from("order_items")
      .select("id, quantity, pack_size, carton_type, product_id, product:products(name, price_per_kg, primary_pack_weight_kg, base_price)")
      .eq("order_id", order.id);

    const items = (data as unknown as OrderItem[]) ?? [];
    setModalItems(items.map(it => {
      const prod = it.product as any;
      const unitPrice = prod?.price_per_kg ?? prod?.base_price ?? 0;
      const packWeight = prod?.primary_pack_weight_kg ?? 1;
      const originalWeight = it.quantity * packWeight;
      const originalLineTotal = originalWeight * unitPrice;
      return {
        ...it,
        packed_qty: it.quantity,
        final_weight_kg: originalWeight,
        original_weight_kg: originalWeight,
        unit_price: unitPrice,
        original_line_total: originalLineTotal,
        final_line_total: originalLineTotal,
      };
    }));
    setModalLoading(false);
  };

  // Recalculate line total when final_weight changes
  const updateItemWeight = (idx: number, newWeight: number) => {
    setModalItems(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        final_weight_kg: newWeight,
        final_line_total: newWeight * updated[idx].unit_price,
      };
      return updated;
    });
  };

  const updateItemQty = (idx: number, newQty: number) => {
    setModalItems(prev => {
      const updated = [...prev];
      const packWeight = (updated[idx].product as any)?.primary_pack_weight_kg ?? 1;
      const newWeight = newQty * packWeight;
      updated[idx] = {
        ...updated[idx],
        packed_qty: newQty,
        final_weight_kg: newWeight,
        final_line_total: newWeight * updated[idx].unit_price,
      };
      return updated;
    });
  };

  // Financial calculations
  const originalInvoiceTotal = modalItems.reduce((s, i) => s + i.original_line_total, 0);
  const finalInvoiceTotal = modalItems.reduce((s, i) => s + i.final_line_total, 0);
  const varianceAmount = originalInvoiceTotal - finalInvoiceTotal;
  const totalPacked = modalItems.reduce((s, i) => s + i.packed_qty, 0);
  const totalFinalWeight = modalItems.reduce((s, i) => s + i.final_weight_kg, 0);

  const handleSubmitDispatch = async () => {
    if (!selectedOrder) return;
    const traceInput = {
      status: selectedOrder.status,
      payment_status: selectedOrder.payment_status,
      advance_paid: selectedOrder.advance_paid,
      advance_required: selectedOrder.advance_required,
      sales_order_value: selectedOrder.sales_order_value,
    };
    if (!canReleaseOrderToDispatch(traceInput)) {
      toast.error(getFinanceReleaseBlockers(traceInput).map((b) => b.message).join("; "));
      return;
    }
    const tp = transporterName.trim();
    const lr = trackingNumber.trim();
    if (!tp) { toast.error("Transporter name is required"); return; }
    if (!lr) { toast.error("LR / Bilty / AWB number is required"); return; }
    if (!dispatchProofFile) { toast.error("Dispatch proof file is required"); return; }
    setSubmitting(true);

    try {
      const ext = dispatchProofFile.name.split(".").pop() || "bin";
      const proofPath = `dispatch-proof/${selectedOrder.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(proofPath, dispatchProofFile);
      if (upErr) {
        console.error(upErr);
        toast.error("Proof upload failed");
        setSubmitting(false);
        return;
      }

      // 1. Create dispatch record (partial legs are flagged; full closure drives order status + security gate)
      const { data: dispatch, error: dispErr } = await supabase.from("dispatches").insert({
        order_id: selectedOrder.id, company_id: selectedOrder.company_id,
        transporter_name: tp, tracking_number: lr,
        driver_name: driverName.trim() || null, driver_phone: driverPhone.trim() || null,
        status: "dispatched", dispatch_date: new Date().toISOString().split("T")[0],
        proof_storage_path: proofPath,
        is_partial: partialDispatch,
      }).select().single();

      if (dispErr || !dispatch) { toast.error("Failed to create dispatch"); setSubmitting(false); return; }

      // 2. Insert packing list
      await supabase.from("packing_lists").insert(modalItems.map(item => ({
        dispatch_id: dispatch.id, product_id: item.product_id, order_item_id: item.id,
        packed_quantity: item.packed_qty, pack_size: item.pack_size, carton_type: item.carton_type,
      })));

      // 3. Update order_items with final weights
      for (const item of modalItems) {
        await (supabase.from("order_items").update as any)({
          actual_packed_qty: item.packed_qty,
          final_weight_kg: item.final_weight_kg,
        }).eq("id", item.id);
      }

      // 4. Full shipment only: close order + notify (after proof persisted on dispatches)
      if (!partialDispatch) {
        await supabase.from("orders").update({
          status: "dispatched",
          sales_order_value: finalInvoiceTotal,
          tracking_number: lr,
        }).eq("id", selectedOrder.id);
        await supabase.from("order_status_history").insert({
          order_id: selectedOrder.id, old_status: "cleared_for_dispatch", new_status: "dispatched",
        });
        notifyOrderDispatched(selectedOrder.id, selectedOrder.id.slice(0, 8).toUpperCase(), {
          transporter: tp,
          lr,
        }).catch(() => {});
      }

      // 5. Wallet reconciliation if variance exists
      if (Math.abs(varianceAmount) > 0.01 && selectedOrder.company_id) {
        // Get current wallet balance
        const { data: company } = await supabase
          .from("companies")
          .select("wallet_balance")
          .eq("id", selectedOrder.company_id)
          .single();

        const currentBalance = company?.wallet_balance ?? 0;
        // varianceAmount > 0 means final < original → credit (refund)
        // varianceAmount < 0 means final > original → debit (charge)
        const newBalance = currentBalance + varianceAmount;

        await supabase.from("companies").update({
          wallet_balance: newBalance,
        }).eq("id", selectedOrder.company_id);

        // 6. Log wallet transaction
        const txType = varianceAmount > 0 ? "credit" : "debit";
        const desc = varianceAmount > 0
          ? `Refund ₹${varianceAmount.toFixed(2)} for short-weight variance on Order ${selectedOrder.id.slice(0, 8)}`
          : `Charge ₹${Math.abs(varianceAmount).toFixed(2)} for over-weight variance on Order ${selectedOrder.id.slice(0, 8)}`;

        await supabase.from("wallet_transactions").insert({
          company_id: selectedOrder.company_id,
          type: txType,
          amount: Math.abs(varianceAmount),
          reference: `weight_variance:${selectedOrder.id}`,
        } as any);

        // Also log to audit_logs for traceability
        await supabase.from("audit_logs").insert({
          module_name: "dispatch",
          action_type: "weight_variance_adjustment",
          entity_id: selectedOrder.id,
          entity_name: "orders",
          reason: desc,
          risk_level: Math.abs(varianceAmount) > 5000 ? "high" : "normal",
          new_value: { finalInvoiceTotal, originalInvoiceTotal, varianceAmount, items: modalItems.map(i => ({ id: i.id, original_weight: i.original_weight_kg, final_weight: i.final_weight_kg })) },
        } as any);
      }

      setSubmitting(false);
      setShowSuccess(true);
      toast.success("Dispatch created with financial reconciliation");
    } catch (err) {
      console.error(err);
      toast.error("Dispatch failed — check console");
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">{t("Packing & Dispatch")}</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "packing" as const, label: t("Packing"), count: packingOrders.length, icon: PackageCheck },
          { key: "dispatch_ready" as const, label: t("Dispatch Ready"), count: dispatchReady.length, icon: Truck },
          { key: "blocked" as const, label: "Blocked by Finance", count: blockedOrders.length, icon: AlertTriangle },
        ].map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-ui-button transition-colors ${tab === tb.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            <tb.icon size={14} /> {tb.label} ({tb.count})
          </button>
        ))}
      </div>

      {/* Workload */}
      <div className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-ui-kpi text-lg text-primary">{packingOrders.length}</p><p className="text-fine text-muted-foreground">Packing</p></div>
          <div><p className="text-ui-kpi text-lg text-primary">{dispatchReady.length}</p><p className="text-fine text-muted-foreground">Ready</p></div>
          <div><p className="text-ui-kpi text-lg text-destructive">{blockedOrders.length}</p><p className="text-fine text-muted-foreground">Blocked</p></div>
        </div>
      </div>

      {/* Orders Table */}
      {displayed.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No orders in this queue.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border bg-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">{t("Company")}</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">{t("Order ID")}</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">{t("Status")}</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">{t("Value")}</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Finance release</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Packed_ready gate</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(order => {
                const blocked = isDispatchFinanceBlocked(order);
                const finState = deriveFinanceReleaseState({
                  status: order.status,
                  payment_status: order.payment_status,
                  advance_paid: order.advance_paid,
                  advance_required: order.advance_required,
                  sales_order_value: order.sales_order_value,
                });
                return (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{order.company?.business_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground text-xs">{order.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${blocked ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                        {blocked ? "Finance Hold" : order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ui-cell text-foreground">₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 align-top">
                      <FinanceReleaseChips variant="compact" state={finState} />
                    </td>
                    <td className="px-4 py-3 text-ui-cell text-xs">
                      {packedReadyChecksByOrder[order.id]?.length === 0 ? (
                        <span className="font-semibold text-emerald-600" title="Eligible for packed_ready">Eligible</span>
                      ) : (
                        <span
                          className="font-semibold text-amber-700"
                          title={(packedReadyChecksByOrder[order.id] || []).map((b) => b.message).join("\n")}
                        >
                          Blocked ({packedReadyChecksByOrder[order.id]?.length ?? 0})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {order.status === "packed_ready" && !blocked && (
                        <button onClick={() => handleAdvanceToPacking(order)} disabled={updating === order.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50">
                          {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />} → Ready
                        </button>
                      )}
                      {order.status === "cleared_for_dispatch" && !blocked && (
                        <button onClick={() => openDispatchModal(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20">
                          <Truck size={12} /> {t("Create Dispatch")}
                        </button>
                      )}
                      {blocked && (
                        <span className="text-fine text-destructive max-w-[140px] inline-block text-left">
                          {getFinanceReleaseBlockers({
                            status: order.status,
                            payment_status: order.payment_status,
                            advance_paid: order.advance_paid,
                            advance_required: order.advance_required,
                            sales_order_value: order.sales_order_value,
                          })
                            .map((b) => b.message)
                            .join(" ") || "Finance hold"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dispatch Modal with Weight Variance Engine */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setShowSuccess(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          {showSuccess ? (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 size={56} className="mx-auto text-green-500" />
              <h2 className="text-display-h2 text-foreground">Dispatch Created</h2>
              {Math.abs(varianceAmount) > 0.01 && (
                <p className="text-sm text-muted-foreground">
                  Wallet {varianceAmount > 0 ? "credited" : "debited"} ₹{Math.abs(varianceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              )}
              <button onClick={() => { setSelectedOrder(null); setShowSuccess(false); fetchOrders(); }}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm">Done</button>
            </div>
          ) : (
            <>
              <DialogHeader><DialogTitle className="text-display-h2 text-primary">{t("Create Dispatch")} — Weight Variance</DialogTitle></DialogHeader>
              {selectedOrder && (
                <div className="space-y-5 mt-2">
                  <div><p className="text-ui-h5 text-foreground">{selectedOrder.company?.business_name}</p><p className="text-fine text-muted-foreground">Order: {selectedOrder.id.slice(0, 12)}…</p></div>

                  {/* Transport fields */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                    <label className="text-ui-label text-foreground flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={partialDispatch} onChange={e => setPartialDispatch(e.target.checked)} className="rounded border-border" />
                      {t("Partial Dispatch")}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">{t("Transporter Name")} *</Label><Input value={transporterName} onChange={e => setTransporterName(e.target.value)} className="rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">LR / Bilty / AWB *</Label><Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className="rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">{t("Driver Name")}</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} className="rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">{t("Driver Phone")}</Label><Input value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="rounded-xl" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-ui-label text-muted-foreground">Dispatch proof (PDF / image) *</Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="rounded-xl cursor-pointer"
                      onChange={(e) => setDispatchProofFile(e.target.files?.[0] ?? null)}
                    />
                    {dispatchProofFile && <p className="text-fine text-muted-foreground">{dispatchProofFile.name}</p>}
                  </div>

                  {/* Weight Variance Packing List */}
                  <div className="border-t border-border pt-4">
                    <h3 className="text-ui-h5 text-foreground mb-3">Weight Variance Packing List</h3>
                    {modalLoading ? <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div> : (
                      <div className="space-y-3">
                        {modalItems.map((item, idx) => {
                          const variance = item.original_line_total - item.final_line_total;
                          const weightDiff = item.final_weight_kg - item.original_weight_kg;
                          return (
                            <div key={item.id} className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-ui-h5 text-foreground">{(item.product as any)?.name ?? "Unknown"}</p>
                                  <p className="text-fine text-muted-foreground">
                                    {item.pack_size ?? "—"} · {item.carton_type ?? "—"} · ₹{item.unit_price.toFixed(2)}/kg
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-fine text-muted-foreground">Qty (packs)</Label>
                                  <Input type="number" min={0} value={item.packed_qty}
                                    onChange={e => updateItemQty(idx, Number(e.target.value) || 0)}
                                    className="text-sm text-center h-8 rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-fine text-muted-foreground">Original Wt (kg)</Label>
                                  <div className="h-8 flex items-center justify-center text-sm text-muted-foreground bg-muted rounded-lg">
                                    {item.original_weight_kg.toFixed(2)}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-fine text-primary font-semibold">Final Wt (kg) *</Label>
                                  <Input type="number" min={0} step={0.01} value={item.final_weight_kg}
                                    onChange={e => updateItemWeight(idx, Number(e.target.value) || 0)}
                                    className="text-sm text-center h-8 rounded-lg border-primary/50 ring-1 ring-primary/20" />
                                </div>
                              </div>
                              {/* Line variance indicator */}
                              <div className="flex justify-between items-center text-xs pt-1">
                                <span className="text-muted-foreground">
                                  Wt Δ: <span className={weightDiff > 0 ? "text-destructive" : weightDiff < 0 ? "text-green-600" : "text-muted-foreground"}>
                                    {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(2)} kg
                                  </span>
                                </span>
                                <span className="text-muted-foreground">
                                  Original: ₹{item.original_line_total.toFixed(2)} → Final: <span className="text-foreground font-semibold">₹{item.final_line_total.toFixed(2)}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Financial Summary */}
                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Packs</span>
                      <span className="text-foreground">{totalPacked} · {Math.floor(totalPacked / PACKS_PER_CARTON)} Cartons</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Final Weight</span>
                      <span className="text-foreground font-semibold">{totalFinalWeight.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Original Invoice</span>
                      <span className="text-foreground">₹{originalInvoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Final Invoice</span>
                      <span className="text-foreground font-bold">₹{finalInvoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>

                    {/* Variance Banner */}
                    {Math.abs(varianceAmount) > 0.01 && (
                      <div className={`flex items-center justify-between p-3 rounded-xl border ${
                        varianceAmount > 0
                          ? "bg-green-500/10 border-green-500/30 text-green-700"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                      }`}>
                        <div className="flex items-center gap-2">
                          {varianceAmount > 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                          <span className="text-sm font-semibold">
                            {varianceAmount > 0 ? "Client Refund (Short-Weight)" : "Client Charge (Over-Weight)"}
                          </span>
                        </div>
                        <span className="text-sm font-bold">
                          {varianceAmount > 0 ? "+" : "-"}₹{Math.abs(varianceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {Math.abs(varianceAmount) <= 0.01 && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border text-muted-foreground text-sm">
                        <Minus size={16} /> No variance — weights match original order
                      </div>
                    )}
                  </div>

                  <button onClick={handleSubmitDispatch} disabled={submitting}
                    className="w-full py-3 rounded-xl font-ui font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Confirm & Dispatch"}
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPackingDispatch;
