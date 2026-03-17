import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Truck, Package, CheckCircle2, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  product_id: string | null;
  product?: { name: string } | null;
}

interface DispatchOrder {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  company?: { business_name: string } | null;
  order_items?: OrderItem[];
}

const PACKS_PER_CARTON = 9;

const AdminDispatch = () => {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [modalItems, setModalItems] = useState<(OrderItem & { packed_qty: number })[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [partialDispatch, setPartialDispatch] = useState(false);
  const [addInsurance, setAddInsurance] = useState(false);

  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const navigate = useNavigate();

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, company:companies(business_name), order_items(id, quantity, pack_size, carton_type, product_id)")
      .in("status", ["packing", "ready_for_dispatch"])
      .order("created_at", { ascending: false });
    setOrders((data as unknown as DispatchOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const openDispatchModal = async (order: DispatchOrder) => {
    setSelectedOrder(order);
    setTransporterName("");
    setTrackingNumber("");
    setDriverName("");
    setDriverPhone("");
    setPartialDispatch(false);
    setAddInsurance(false);
    setShowSuccess(false);
    setModalLoading(true);

    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, pack_size, carton_type, product_id, product:products(name)")
      .eq("order_id", order.id);

    setModalItems(((data as unknown as OrderItem[]) ?? []).map((it) => ({
      ...it,
      packed_qty: it.quantity,
    })));
    setModalLoading(false);
  };

  const handleSubmitDispatch = async () => {
    if (!selectedOrder) return;
    if (!transporterName.trim()) { toast.error("Transporter name is required"); return; }
    setSubmitting(true);

    const { data: dispatch, error: dispatchErr } = await supabase
      .from("dispatches")
      .insert({
        order_id: selectedOrder.id,
        company_id: selectedOrder.company_id,
        transporter_name: transporterName,
        tracking_number: trackingNumber,
        driver_name: driverName,
        driver_phone: driverPhone,
        status: "dispatched",
        dispatch_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (dispatchErr || !dispatch) {
      toast.error("Failed to create dispatch");
      setSubmitting(false);
      return;
    }

    const packingEntries = modalItems.map((item) => ({
      dispatch_id: dispatch.id,
      product_id: item.product_id,
      order_item_id: item.id,
      packed_quantity: item.packed_qty,
      pack_size: item.pack_size,
      carton_type: item.carton_type,
    }));

    await supabase.from("packing_lists").insert(packingEntries);

    // If partial dispatch, keep order open; otherwise mark dispatched
    if (!partialDispatch) {
      await supabase.from("orders").update({ status: "dispatched" }).eq("id", selectedOrder.id);
    }

    setSubmitting(false);
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setSelectedOrder(null);
    setShowSuccess(false);
    fetchOrders();
    navigate("/admin/dispatch");
  };

  const totalPacked = modalItems.reduce((s, i) => s + i.packed_qty, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">Dispatch</h1>

      {orders.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No orders ready for dispatch.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Order ID</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Value</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Packs / Cartons</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const totalPacks = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
                const totalCartons = Math.floor(totalPacks / PACKS_PER_CARTON);
                return (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{order.company?.business_name ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground text-xs">{order.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">{order.status}</span>
                    </td>
                    <td className="px-4 py-3 text-ui-cell text-foreground">₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">
                      {totalPacks} Packs · {totalCartons} Cartons
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openDispatchModal(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Truck size={14} /> Create Dispatch
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setShowSuccess(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white border-border">
          {showSuccess ? (
            <div className="text-center py-10 space-y-4">
              <CheckCircle2 size={56} className="mx-auto text-green-500" />
              <h2 className="text-display-h2 text-foreground">Dispatch Created Successfully</h2>
              <p className="text-body-p2 text-muted-foreground">Invoice & Waybill have been generated.</p>
              <button
                onClick={handleSuccessClose}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                View Documents
              </button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-display-h2 text-primary">Create Dispatch</DialogTitle>
              </DialogHeader>
              {selectedOrder && (
                <div className="space-y-5 mt-2">
                  <div className="space-y-1">
                    <p className="text-ui-h5 text-foreground">{selectedOrder.company?.business_name ?? "Unknown"}</p>
                    <p className="text-ui-cell text-muted-foreground">Order: {selectedOrder.id.slice(0, 12)}…</p>
                  </div>

                  {/* Dispatch type toggle */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                    <label className="text-ui-label text-foreground flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={partialDispatch}
                        onChange={(e) => setPartialDispatch(e.target.checked)}
                        className="rounded border-border"
                      />
                      Partial Dispatch
                    </label>
                    <span className="text-fine text-muted-foreground">
                      {partialDispatch ? "Order stays open for future dispatches" : "Full dispatch — order will be closed"}
                    </span>
                  </div>

                  {/* Transport Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-ui-label text-muted-foreground">Transporter Name *</Label>
                      <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} className="rounded-xl" placeholder="e.g. VRL Logistics" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-ui-label text-muted-foreground">LR / Bilty Number</Label>
                      <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="rounded-xl" placeholder="LR-00123" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-ui-label text-muted-foreground">Driver Name</Label>
                      <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="rounded-xl" placeholder="Driver name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-ui-label text-muted-foreground">Driver Phone</Label>
                      <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className="rounded-xl" placeholder="+91 98765 43210" />
                    </div>
                  </div>

                  {/* Insurance */}
                  <label className="flex items-center gap-2 text-ui-label text-foreground cursor-pointer">
                    <input type="checkbox" checked={addInsurance} onChange={(e) => setAddInsurance(e.target.checked)} className="rounded border-border" />
                    <Shield size={14} className="text-primary" />
                    Add Insurance
                  </label>

                  {/* Packing Items */}
                  <div className="border-t border-border pt-4">
                    <h3 className="text-ui-h5 text-foreground mb-3">Packing List — Actual Packed Quantity</h3>
                    {modalLoading ? (
                      <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div>
                    ) : (
                      <div className="space-y-2">
                        {modalItems.map((item, idx) => {
                          const itemPacks = item.packed_qty;
                          const itemCartons = Math.floor(itemPacks / PACKS_PER_CARTON);
                          return (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                              <div className="flex-1">
                                <p className="text-ui-h5 text-foreground">{(item.product as any)?.name ?? "Unknown"}</p>
                                <p className="text-fine text-muted-foreground">
                                  {item.pack_size ?? "—"} · {item.carton_type ?? "—"} · Ordered: {item.quantity} packs
                                </p>
                              </div>
                              <div className="w-20 ml-3">
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.packed_qty}
                                  onChange={(e) => {
                                    const updated = [...modalItems];
                                    updated[idx] = { ...updated[idx], packed_qty: Number(e.target.value) || 0 };
                                    setModalItems(updated);
                                  }}
                                  className="text-sm text-center h-8 rounded-lg"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4 flex justify-between items-center">
                    <span className="text-ui-label text-muted-foreground">Total Packed</span>
                    <span className="text-ui-kpi text-foreground">
                      {totalPacked} Packs · {Math.floor(totalPacked / PACKS_PER_CARTON)} Cartons
                    </span>
                  </div>

                  <button
                    onClick={handleSubmitDispatch}
                    disabled={submitting}
                    className="w-full py-3 rounded-xl font-ui font-semibold text-sm transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
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

export default AdminDispatch;
