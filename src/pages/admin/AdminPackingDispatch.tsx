import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRight, Truck, PackageCheck, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/hooks/useLanguage";

const PACKS_PER_CARTON = 9;

interface OrderItem {
  id: string; quantity: number; pack_size: string | null;
  carton_type: string | null; product_id: string | null;
  product?: { name: string } | null;
}

interface DispatchOrder {
  id: string; status: string; sales_order_value: number | null;
  payment_status: string | null; advance_paid: number | null; advance_required: number | null;
  company_id: string | null; company?: { business_name: string } | null;
  order_items?: OrderItem[];
}

const AdminPackingDispatch = () => {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"packing" | "dispatch_ready" | "blocked">("packing");
  const [updating, setUpdating] = useState<string | null>(null);
  const { t } = useLanguage();

  // Dispatch modal state
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [modalItems, setModalItems] = useState<(OrderItem & { packed_qty: number })[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [partialDispatch, setPartialDispatch] = useState(false);
  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, status, sales_order_value, payment_status, advance_paid, advance_required, company_id, company:companies(business_name), order_items(id, quantity, pack_size, carton_type, product_id)")
      .in("status", ["packed_ready", "cleared_for_dispatch"])
      .order("created_at", { ascending: true });
    setOrders((data as unknown as DispatchOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const isFinanceBlocked = (o: DispatchOrder) => {
    const advReq = o.advance_required ?? 0;
    const advPaid = o.advance_paid ?? 0;
    return advReq > 0 && advPaid < advReq;
  };

  const packingOrders = orders.filter(o => o.status === "packing");
  const dispatchReady = orders.filter(o => o.status === "ready_for_dispatch" && !isFinanceBlocked(o));
  const blockedOrders = orders.filter(o => isFinanceBlocked(o));

  const displayed = tab === "packing" ? packingOrders : tab === "dispatch_ready" ? dispatchReady : blockedOrders;

  const handleAdvanceToPacking = async (order: DispatchOrder) => {
    setUpdating(order.id);
    await supabase.from("orders").update({ status: "ready_for_dispatch" }).eq("id", order.id);
    await supabase.from("order_status_history").insert({ order_id: order.id, old_status: "packing", new_status: "ready_for_dispatch" });
    toast.success(`Moved to ${t("Dispatch Ready")}`);
    setUpdating(null);
    fetchOrders();
  };

  const openDispatchModal = async (order: DispatchOrder) => {
    setSelectedOrder(order);
    setTransporterName(""); setTrackingNumber(""); setDriverName(""); setDriverPhone("");
    setPartialDispatch(false); setShowSuccess(false); setModalLoading(true);
    const { data } = await supabase.from("order_items")
      .select("id, quantity, pack_size, carton_type, product_id, product:products(name)")
      .eq("order_id", order.id);
    setModalItems(((data as unknown as OrderItem[]) ?? []).map(it => ({ ...it, packed_qty: it.quantity })));
    setModalLoading(false);
  };

  const handleSubmitDispatch = async () => {
    if (!selectedOrder) return;
    if (!transporterName.trim()) { toast.error("Transporter name is required"); return; }
    setSubmitting(true);
    const { data: dispatch, error } = await supabase.from("dispatches").insert({
      order_id: selectedOrder.id, company_id: selectedOrder.company_id,
      transporter_name: transporterName, tracking_number: trackingNumber,
      driver_name: driverName, driver_phone: driverPhone,
      status: "dispatched", dispatch_date: new Date().toISOString().split("T")[0],
    }).select().single();
    if (error || !dispatch) { toast.error("Failed to create dispatch"); setSubmitting(false); return; }
    await supabase.from("packing_lists").insert(modalItems.map(item => ({
      dispatch_id: dispatch.id, product_id: item.product_id, order_item_id: item.id,
      packed_quantity: item.packed_qty, pack_size: item.pack_size, carton_type: item.carton_type,
    })));
    if (!partialDispatch) {
      await supabase.from("orders").update({ status: "dispatched" }).eq("id", selectedOrder.id);
      await supabase.from("order_status_history").insert({ order_id: selectedOrder.id, old_status: "ready_for_dispatch", new_status: "dispatched" });
    }
    setSubmitting(false);
    setShowSuccess(true);
  };

  const totalPacked = modalItems.reduce((s, i) => s + i.packed_qty, 0);

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

      {/* Orders */}
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
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(order => {
                const blocked = isFinanceBlocked(order);
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
                    <td className="px-4 py-3 text-right space-x-2">
                      {order.status === "packing" && !blocked && (
                        <button onClick={() => handleAdvanceToPacking(order)} disabled={updating === order.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50">
                          {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />} → Ready
                        </button>
                      )}
                      {order.status === "ready_for_dispatch" && !blocked && (
                        <button onClick={() => openDispatchModal(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20">
                          <Truck size={12} /> {t("Create Dispatch")}
                        </button>
                      )}
                      {blocked && (
                        <span className="text-fine text-destructive">Advance pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dispatch Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setShowSuccess(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
          {showSuccess ? (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 size={56} className="mx-auto text-green-500" />
              <h2 className="text-display-h2 text-foreground">Dispatch Created</h2>
              <button onClick={() => { setSelectedOrder(null); setShowSuccess(false); fetchOrders(); }}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm">Done</button>
            </div>
          ) : (
            <>
              <DialogHeader><DialogTitle className="text-display-h2 text-primary">{t("Create Dispatch")}</DialogTitle></DialogHeader>
              {selectedOrder && (
                <div className="space-y-5 mt-2">
                  <div><p className="text-ui-h5 text-foreground">{selectedOrder.company?.business_name}</p><p className="text-fine text-muted-foreground">Order: {selectedOrder.id.slice(0, 12)}…</p></div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                    <label className="text-ui-label text-foreground flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={partialDispatch} onChange={e => setPartialDispatch(e.target.checked)} className="rounded border-border" />
                      {t("Partial Dispatch")}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">{t("Transporter Name")} *</Label><Input value={transporterName} onChange={e => setTransporterName(e.target.value)} className="rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">LR / Bilty</Label><Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className="rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">{t("Driver Name")}</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} className="rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-ui-label text-muted-foreground">{t("Driver Phone")}</Label><Input value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="rounded-xl" /></div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <h3 className="text-ui-h5 text-foreground mb-3">Packing List</h3>
                    {modalLoading ? <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div> : (
                      <div className="space-y-2">
                        {modalItems.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                            <div className="flex-1">
                              <p className="text-ui-h5 text-foreground">{(item.product as any)?.name ?? "Unknown"}</p>
                              <p className="text-fine text-muted-foreground">{item.pack_size ?? "—"} · {item.carton_type ?? "—"} · Ordered: {item.quantity}</p>
                            </div>
                            <div className="w-20 ml-3">
                              <Input type="number" min={0} value={item.packed_qty}
                                onChange={e => { const u = [...modalItems]; u[idx] = { ...u[idx], packed_qty: Number(e.target.value) || 0 }; setModalItems(u); }}
                                className="text-sm text-center h-8 rounded-lg" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border pt-4 flex justify-between"><span className="text-ui-label text-muted-foreground">Total</span><span className="text-ui-kpi text-foreground">{totalPacked} Packs · {Math.floor(totalPacked / PACKS_PER_CARTON)} Cartons</span></div>
                  <button onClick={handleSubmitDispatch} disabled={submitting} className="w-full py-3 rounded-xl font-ui font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Submit Dispatch"}
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
