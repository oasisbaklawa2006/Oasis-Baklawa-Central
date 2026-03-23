import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Truck, Package, CheckCircle2, Shield, MapPin, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNavBar from "@/components/TopNavBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  company?: { business_name: string; billing_address?: string; phone?: string } | null;
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

  // Dispatch Form State
  const [partialDispatch, setPartialDispatch] = useState(false);
  const [addInsurance, setAddInsurance] = useState(false);
  const [transporterName, setTransporterName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const navigate = useNavigate();

  const fetchOrders = async () => {
    setLoading(true);
    // Added packed_ready just in case the floor controller uses that status
    const { data } = await supabase
      .from("orders")
      .select(
        "*, company:companies(business_name, billing_address, phone), order_items(id, quantity, pack_size, carton_type, product_id)",
      )
      .in("status", ["packing", "ready_for_dispatch", "packed_ready"])
      .order("created_at", { ascending: false });

    setOrders((data as unknown as DispatchOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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

    setModalItems(
      ((data as unknown as OrderItem[]) ?? []).map((it) => ({
        ...it,
        packed_qty: it.quantity,
      })),
    );
    setModalLoading(false);
  };

  const handleSubmitDispatch = async () => {
    if (!selectedOrder) return;
    if (!transporterName.trim()) {
      toast.error("Transporter name is required");
      return;
    }
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

    if (!partialDispatch) {
      await supabase.from("orders").update({ status: "dispatched" }).eq("id", selectedOrder.id);
      await supabase
        .from("order_status_history")
        .insert({ order_id: selectedOrder.id, old_status: selectedOrder.status, new_status: "dispatched" });
    }

    setSubmitting(false);
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setSelectedOrder(null);
    setShowSuccess(false);
    fetchOrders();
  };

  const totalPacked = modalItems.reduce((s, i) => s + i.packed_qty, 0);
  const totalPendingPacks = orders.reduce(
    (sum, order) => sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0),
    0,
  );

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 min-h-screen bg-slate-50">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <TopNavBar />
      <main className="pt-24 px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-display-h2 text-slate-900 font-bold flex items-center gap-3">
            <Truck className="text-[#B8860B]" size={32} /> Dispatch & Logistics
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            Generate packing slips, assign transporters, and ship.
          </p>
        </div>

        {/* KPI BAR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Outbound Workload</span>
            <p className="text-lg font-black text-slate-900 mt-0.5">{orders.length} Deliveries Pending</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
            <Package size={20} className="text-slate-400" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Volume</p>
              <p className="text-sm font-black text-slate-900">{totalPendingPacks} Packs/Cartons</p>
            </div>
          </div>
        </div>

        {/* DISPATCH LIST */}
        {orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <Truck size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest">Dispatch Bay is Empty</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Waiting for production to finish batches.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {orders.map((order) => {
              const totalPacks = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
              const totalCartons = Math.floor(totalPacks / PACKS_PER_CARTON);
              const companyName = order.company?.business_name ?? "Direct Customer";

              return (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-2 inline-block border border-emerald-100">
                          Ready for Dispatch
                        </span>
                        <h3 className="text-xl font-black text-slate-900 leading-tight">{companyName}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1 font-mono uppercase">
                          ID: {order.id.split("-")[0]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Value</p>
                        <p className="text-lg font-black text-[#B8860B]">
                          ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs font-bold text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-4">
                      <MapPin size={14} className="shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {order.company?.billing_address || "No shipping address provided."}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                    <div>
                      <p className="text-sm font-black text-slate-900">{totalPacks} Packs</p>
                      <p className="text-xs font-bold text-slate-500">~{totalCartons} Cartons</p>
                    </div>
                    <button
                      onClick={() => openDispatchModal(order)}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black transition-colors flex items-center gap-2"
                    >
                      <Printer size={16} /> Process Dispatch
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* DISPATCH PROCESSING MODAL */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setShowSuccess(false);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border-slate-200 rounded-3xl p-0 overflow-hidden">
          {showSuccess ? (
            <div className="text-center py-16 px-6 bg-slate-50 space-y-4">
              <CheckCircle2 size={64} className="mx-auto text-emerald-500" />
              <h2 className="text-2xl font-black text-slate-900">Dispatch Created Successfully!</h2>
              <p className="text-sm font-bold text-slate-500">Invoice & Waybill have been generated and logged.</p>
              <button
                onClick={handleSuccessClose}
                className="mt-4 px-8 py-3 rounded-xl bg-[#B8860B] text-white font-bold text-sm hover:bg-[#9A7009] transition-colors shadow-lg shadow-[#B8860B]/20"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Truck className="text-[#B8860B]" /> Create Dispatch
                </DialogTitle>
              </DialogHeader>

              {selectedOrder && (
                <div className="px-6 pb-6 space-y-6 mt-4">
                  {/* Client Info */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-lg font-black text-slate-900 leading-tight">
                      {selectedOrder.company?.business_name ?? "Unknown"}
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
                      Order: {selectedOrder.id.split("-")[0]}
                    </p>
                  </div>

                  {/* Transport Details Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Transporter Name *
                      </Label>
                      <Input
                        value={transporterName}
                        onChange={(e) => setTransporterName(e.target.value)}
                        className="rounded-xl bg-slate-50 font-bold"
                        placeholder="e.g. VRL Logistics"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        LR / Bilty Number
                      </Label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="rounded-xl bg-slate-50 font-bold"
                        placeholder="LR-00123"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Driver Name</Label>
                      <Input
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="rounded-xl bg-slate-50 font-bold"
                        placeholder="Driver name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Driver Phone</Label>
                      <Input
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        className="rounded-xl bg-slate-50 font-bold"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-col gap-3">
                    <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={partialDispatch}
                        onChange={(e) => setPartialDispatch(e.target.checked)}
                        className="mt-1 w-4 h-4 text-[#B8860B] rounded border-slate-300"
                      />
                      <div>
                        <span className="font-bold text-sm text-slate-900 block">Partial Dispatch</span>
                        <span className="text-xs text-slate-500 font-medium">
                          Order stays open for future dispatches.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={addInsurance}
                        onChange={(e) => setAddInsurance(e.target.checked)}
                        className="w-4 h-4 text-[#B8860B] rounded border-slate-300"
                      />
                      <Shield size={16} className="text-[#B8860B]" />
                      <span className="font-bold text-sm text-slate-900 block">Add Transit Insurance</span>
                    </label>
                  </div>

                  {/* Packing List Adjustments */}
                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                      <span>Packing List Verification</span>
                      {modalLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                    </h3>

                    {!modalLoading && (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {modalItems.map((item, idx) => {
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white"
                            >
                              <div className="flex-1 pr-4">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {(item.product as any)?.name ?? "Unknown Item"}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                  Ordered: {item.quantity} units
                                </p>
                              </div>
                              <div className="w-24 shrink-0 flex flex-col items-end">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                  Packed Qty
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.packed_qty}
                                  onChange={(e) => {
                                    const updated = [...modalItems];
                                    updated[idx] = { ...updated[idx], packed_qty: Number(e.target.value) || 0 };
                                    setModalItems(updated);
                                  }}
                                  className="text-center h-9 rounded-lg font-black bg-slate-50 border-slate-200 focus:border-[#B8860B]"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center mb-4 bg-slate-900 text-white p-4 rounded-xl">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Outbound</span>
                      <span className="text-lg font-black">
                        {totalPacked} Packs{" "}
                        <span className="text-slate-500 text-sm ml-1 font-bold">
                          ~{Math.floor(totalPacked / PACKS_PER_CARTON)} Cartons
                        </span>
                      </span>
                    </div>

                    <button
                      onClick={handleSubmitDispatch}
                      disabled={submitting}
                      className="w-full py-4 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 bg-[#B8860B] text-white hover:bg-[#9A7009] shadow-lg shadow-[#B8860B]/20 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <Truck size={18} /> Confirm & Generate Waybill
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdminDispatch;
