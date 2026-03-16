import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Truck, Package } from "lucide-react";
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

const AdminDispatch = () => {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [modalItems, setModalItems] = useState<(OrderItem & { packed_qty: number })[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

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
    setModalLoading(true);

    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, pack_size, carton_type, product_id, product:products(name)")
      .eq("order_id", order.id);

    const items = ((data as unknown as OrderItem[]) ?? []).map((it) => ({
      ...it,
      packed_qty: it.quantity,
    }));
    setModalItems(items);
    setModalLoading(false);
  };

  const handleSubmitDispatch = async () => {
    if (!selectedOrder) return;
    if (!transporterName.trim()) {
      toast.error("Transporter name is required");
      return;
    }

    setSubmitting(true);

    // Create dispatch record
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

    // Insert packing list entries
    const packingEntries = modalItems.map((item) => ({
      dispatch_id: dispatch.id,
      product_id: item.product_id,
      packed_quantity: item.packed_qty,
    }));

    await supabase.from("packing_lists").insert(packingEntries);

    // Update order status to dispatched
    await supabase
      .from("orders")
      .update({ status: "dispatched" })
      .eq("id", selectedOrder.id);

    toast.success("Dispatch created successfully");
    setSubmitting(false);
    setSelectedOrder(null);
    fetchOrders();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "#c6a769" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl" style={{ color: "#c6a769" }}>Dispatch</h1>

      {orders.length === 0 ? (
        <p className="text-[#888] text-sm font-body">No orders ready for dispatch.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#2a2a2a" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Company</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Order ID</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Status</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Value</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Items</th>
                <th className="text-right px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t" style={{ borderColor: "#2a2a2a" }}>
                  <td className="px-4 py-3 font-body text-white">
                    {order.company?.business_name ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3 font-body text-[#aaa] text-xs">
                    {order.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-white">
                    ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 font-body text-[#aaa]">
                    {order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0} cartons
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDispatchModal(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#c6a769]/20 text-[#c6a769] hover:bg-[#c6a769]/30 transition-colors ml-auto"
                    >
                      <Truck size={14} /> Create Dispatch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dispatch Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-lg" style={{ color: "#c6a769" }}>
              Create Dispatch
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5 mt-2">
              <div className="space-y-1">
                <p className="font-body text-sm text-white">
                  {selectedOrder.company?.business_name ?? "Unknown"}
                </p>
                <p className="font-body text-xs text-[#666]">Order: {selectedOrder.id.slice(0, 12)}…</p>
              </div>

              {/* Transport Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#888]">Transporter Name *</Label>
                  <Input
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                    className="bg-[#111] border-[#2a2a2a] text-white text-sm"
                    placeholder="e.g. VRL Logistics"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#888]">Tracking / LR Number</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="bg-[#111] border-[#2a2a2a] text-white text-sm"
                    placeholder="LR-00123"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#888]">Driver Name</Label>
                  <Input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="bg-[#111] border-[#2a2a2a] text-white text-sm"
                    placeholder="Driver name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#888]">Driver Phone</Label>
                  <Input
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="bg-[#111] border-[#2a2a2a] text-white text-sm"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              {/* Packing Items */}
              <div className="border-t pt-4" style={{ borderColor: "#2a2a2a" }}>
                <h3 className="font-body font-semibold text-sm text-white mb-3">Packing List</h3>

                {modalLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin" style={{ color: "#c6a769" }} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modalItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ backgroundColor: "#111111", borderColor: "#2a2a2a" }}
                      >
                        <div className="flex-1">
                          <p className="font-body text-sm text-white">
                            {(item.product as any)?.name ?? "Unknown"}
                          </p>
                          <p className="font-body text-xs text-[#666]">
                            {item.pack_size ?? "—"} · {item.carton_type ?? "—"} · Ordered: {item.quantity}
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
                            className="bg-[#1a1a1a] border-[#2a2a2a] text-white text-sm text-center h-8"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 flex justify-between items-center" style={{ borderColor: "#2a2a2a" }}>
                <span className="font-body text-sm text-[#888]">Total Packed</span>
                <span className="font-body font-bold text-white">
                  {modalItems.reduce((s, i) => s + i.packed_qty, 0)} cartons
                </span>
              </div>

              <button
                onClick={handleSubmitDispatch}
                disabled={submitting}
                className="w-full py-3 rounded-xl font-body font-semibold text-sm transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#c6a769", color: "#1c1c1c" }}
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin mx-auto" />
                ) : (
                  "Submit Dispatch"
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDispatch;
