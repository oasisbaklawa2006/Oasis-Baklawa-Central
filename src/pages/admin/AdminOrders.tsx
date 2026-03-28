import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Loader2, X, FileText, CheckCircle2, Truck, Printer, Package, ClipboardList, Zap, LayoutList } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { generateProFormaInvoice } from "@/utils/invoiceGenerator";
const PACKS_PER_CARTON = 9;

const STATUSES = [
  "submitted",
  "in_production",
  "packed_ready",
  "awaiting_final_payment",
  "cleared_for_dispatch",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  in_production: "In Production",
  packed_ready: "Packed Ready",
  awaiting_final_payment: "Awaiting Final Payment",
  cleared_for_dispatch: "Cleared for Dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  submitted: "hsl(210, 60%, 55%)",
  in_production: "hsl(220, 70%, 55%)",
  packed_ready: "hsl(150, 50%, 45%)",
  awaiting_final_payment: "hsl(40, 40%, 59%)",
  cleared_for_dispatch: "hsl(30, 70%, 50%)",
  dispatched: "hsl(170, 55%, 45%)",
  delivered: "hsl(140, 60%, 40%)",
  cancelled: "hsl(0, 50%, 45%)",
};

const TERMINAL = new Set(["closed", "cancelled", "delivered"]);

// Statuses at or after packed_ready
const PACKED_OR_LATER = new Set(["packed_ready", "awaiting_final_payment", "cleared_for_dispatch", "dispatched", "delivered"]);

interface OrderItem {
  id: string;
  quantity: number;
  actual_packed_qty: number | null;
  product_id: string | null;
  pack_size?: string | null;
  carton_type?: string | null;
  products?: { name: string; hsn_code?: string; gst_rate?: number; gst_percentage?: number; price_per_kg?: number; primary_pack_weight_kg?: number; category?: string; [key: string]: any } | null;
  product?: { name: string } | null;
}

interface OrderCard {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  document_stage: string | null;
  payment_cleared: boolean | null;
  eway_bill_number: string | null;
  gate_pass_number: string | null;
  company?: { business_name: string; gst_number?: string | null } | null;
  order_items?: OrderItem[];
}

const AdminOrders = () => {
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [drawerItems, setDrawerItems] = useState<OrderItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [ewayInput, setEwayInput] = useState("");
  const [gatePassInput, setGatePassInput] = useState("");
  const [financeUpdating, setFinanceUpdating] = useState(false);

  // Packing list state: map of item id -> actual packed qty
  const [packingQtys, setPackingQtys] = useState<Record<string, number>>({});
  const [packingSaving, setPackingSaving] = useState(false);

  // Auto-splitter state
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, status, sales_order_value, company_id,
        document_stage, payment_cleared, eway_bill_number, gate_pass_number,
        order_items ( id, quantity, product_id, actual_packed_qty )
      `,
      )
      .in("status", [...STATUSES]);

    if (error) {
      console.error("Database Error Details:", error);
      toast.error(`Database Error: ${error.message}`);
    } else {
      setOrders((data as unknown as OrderCard[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const nextStatus = (current: string): string | null => {
    if (TERMINAL.has(current)) return null;
    const idx = STATUSES.indexOf(current as OrderStatus);
    if (idx < 0 || idx >= STATUSES.length - 1) return null;
    const next = STATUSES[idx + 1];
    if (next === "cancelled") return null;
    return next;
  };

  const handleAdvance = async (order: OrderCard) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setUpdating(order.id);

    const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Moved to ${STATUS_LABELS[next as OrderStatus]}`);
      await fetchOrders();
    }
    setUpdating(null);
  };

  // ═══ AUTO-SPLITTER LOGIC ═══
  const fetchRequisitions = async (orderId: string) => {
    setReqLoading(true);
    const { data } = await supabase
      .from("store_requisitions")
      .select("id, target_store, status, store_requisition_items(id, product_id, requested_qty)")
      .eq("order_id", orderId);
    setRequisitions(data ?? []);
    setReqLoading(false);
  };

  const handleAutoSplitOrder = async (orderId: string, items: OrderItem[]) => {
    setSplitting(true);
    try {
      // Fetch product default_store for each item
      const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
      const { data: products } = await supabase
        .from("products")
        .select("id, default_store")
        .in("id", productIds);

      const storeMap: Record<string, string> = {};
      (products ?? []).forEach((p: any) => {
        storeMap[p.id] = p.default_store || "ready_goods";
      });

      // Group items by target store
      const groups: Record<string, { product_id: string; requested_qty: number }[]> = {};
      for (const item of items) {
        const store = item.product_id ? (storeMap[item.product_id] || "ready_goods") : "ready_goods";
        if (!groups[store]) groups[store] = [];
        groups[store].push({ product_id: item.product_id!, requested_qty: item.quantity });
      }

      // Insert requisitions + items per group
      for (const [store, storeItems] of Object.entries(groups)) {
        const { data: req, error: reqErr } = await supabase
          .from("store_requisitions")
          .insert({ order_id: orderId, target_store: store, status: "pending" })
          .select("id")
          .single();

        if (reqErr || !req) {
          toast.error(`Failed to create requisition for ${store}`);
          continue;
        }

        const itemsToInsert = storeItems
          .filter(si => si.product_id)
          .map(si => ({
            requisition_id: req.id,
            product_id: si.product_id,
            requested_qty: si.requested_qty,
          }));

        if (itemsToInsert.length > 0) {
          const { error: itemErr } = await supabase
            .from("store_requisition_items")
            .insert(itemsToInsert);
          if (itemErr) toast.error(`Failed to insert items for ${store}`);
        }
      }

      toast.success("Order auto-split & routed to stores!");
      await fetchRequisitions(orderId);
    } catch (err: any) {
      toast.error(err.message || "Auto-split failed");
    }
    setSplitting(false);
  };

  const handleOpenDrawer = async (order: OrderCard) => {
    setSelectedOrder(order);
    setDrawerLoading(true);
    setEwayInput(order.eway_bill_number ?? "");
    setGatePassInput(order.gate_pass_number ?? "");
    setRequisitions([]);

    const { data, error } = await supabase
      .from("order_items")
      .select(`id, quantity, actual_packed_qty, product_id, pack_size, carton_type, products (*)`)
      .eq("order_id", order.id);

    if (error) console.error(error);
    const items = (data as unknown as OrderItem[]) ?? [];
    setDrawerItems(items);

    // Init packing qtys from items
    const initQtys: Record<string, number> = {};
    items.forEach(i => {
      initQtys[i.id] = i.actual_packed_qty ?? i.quantity;
    });
    setPackingQtys(initQtys);

    // Fetch existing requisitions
    await fetchRequisitions(order.id);

    setDrawerLoading(false);
  };

  const closeDrawer = () => {
    setSelectedOrder(null);
    setTimeout(() => setDrawerItems([]), 300);
  };

  // Save packing list & mark packed_ready
  const handleSavePackingList = async () => {
    if (!selectedOrder) return;
    setPackingSaving(true);

    try {
      // Update each item's actual_packed_qty
      for (const item of drawerItems) {
        const qty = packingQtys[item.id] ?? item.quantity;
        await supabase
          .from("order_items")
          .update({ actual_packed_qty: qty })
          .eq("id", item.id);
      }

      // Move order to packed_ready
      await supabase
        .from("orders")
        .update({ status: "packed_ready" })
        .eq("id", selectedOrder.id);

      await supabase
        .from("order_status_history")
        .insert({ order_id: selectedOrder.id, old_status: selectedOrder.status, new_status: "packed_ready" });

      toast.success("Packing list saved — Order marked Packed Ready");
      setSelectedOrder(prev => prev ? { ...prev, status: "packed_ready" } : prev);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to save packing list");
    }
    setPackingSaving(false);
  };

  const handleGeneratePI = async (orderId: string) => {
    setFinanceUpdating(true);
    const { error } = await supabase.from("orders").update({ document_stage: "PI" }).eq("id", orderId);
    if (error) toast.error("Failed to generate PI");
    else {
      toast.success("Proforma Invoice generated");
      setSelectedOrder(prev => prev ? { ...prev, document_stage: "PI" } : prev);
      await fetchOrders();
    }
    setFinanceUpdating(false);
  };

  const handleMarkPaymentCleared = async (orderId: string) => {
    setFinanceUpdating(true);
    const { error } = await supabase.from("orders").update({ payment_cleared: true, document_stage: "Final" }).eq("id", orderId);
    if (error) toast.error("Failed to mark payment");
    else {
      toast.success("Payment cleared — Final Invoice generated");
      setSelectedOrder(prev => prev ? { ...prev, payment_cleared: true, document_stage: "Final" } : prev);
      await fetchOrders();
    }
    setFinanceUpdating(false);
  };

  const handleSaveEwayBill = async (orderId: string) => {
    if (!ewayInput.trim()) return toast.error("Enter an E-Way Bill number");
    setFinanceUpdating(true);
    const { error } = await supabase.from("orders").update({ eway_bill_number: ewayInput.trim() }).eq("id", orderId);
    if (error) toast.error("Failed to save E-Way Bill");
    else {
      toast.success("E-Way Bill saved");
      setSelectedOrder(prev => prev ? { ...prev, eway_bill_number: ewayInput.trim() } : prev);
      await fetchOrders();
    }
    setFinanceUpdating(false);
  };

  const handleSaveGatePass = async (orderId: string) => {
    if (!gatePassInput.trim()) return toast.error("Enter a Gate Pass number");
    setFinanceUpdating(true);
    const { error } = await supabase.from("orders").update({ gate_pass_number: gatePassInput.trim() }).eq("id", orderId);
    if (error) toast.error("Failed to save Gate Pass");
    else {
      toast.success("Gate Pass saved");
      setSelectedOrder(prev => prev ? { ...prev, gate_pass_number: gatePassInput.trim() } : prev);
      await fetchOrders();
    }
    setFinanceUpdating(false);
  };

  const handlePrintInvoice = async (order: OrderCard) => {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select(`id, quantity, actual_packed_qty, product_id, pack_size, carton_type, products (*)`)
        .eq("order_id", order.id);
      if (itemsErr) throw itemsErr;

      let companyDetails: { business_name: string; gst_number?: string | null } | null = null;
      if (order.company_id) {
        const { data: co } = await supabase
          .from("companies")
          .select("business_name, gst_number")
          .eq("id", order.company_id)
          .maybeSingle();
        companyDetails = co;
      }

      // Use actual_packed_qty for PI (falls back to quantity)
      const cartItems = (items || []).map((item: any) => ({
        id: item.id,
        quantity: item.actual_packed_qty ?? item.quantity,
        product: item.products,
      }));

      generateProFormaInvoice(cartItems, companyDetails, null);
      toast.success("Proforma Invoice PDF generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice");
    }
  };

  const getTotalPacks = (items?: { quantity: number }[]) =>
    items?.reduce((sum, it) => sum + Number(it.quantity), 0) ?? 0;

  const getProductName = (item: OrderItem) => {
    return item.products?.name || item.product?.name || "Unknown Product";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const isPackedOrLater = selectedOrder ? PACKED_OR_LATER.has(selectedOrder.status) : false;
  const isClearedForDispatch = selectedOrder?.status === "cleared_for_dispatch";
  const isInProduction = selectedOrder?.status === "in_production";

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden flex flex-col">
      <TopNavBar />

      <main className="pt-24 px-5 flex-1 max-w-[100vw] overflow-hidden flex flex-col">
        <div className="mb-6">
          <h1 className="text-display-h2 text-foreground">Order Pipeline</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Drag-and-drop fulfillment flow</p>
        </div>

        <div className="overflow-x-auto flex-1 pb-4 no-scrollbar cursor-grab active:cursor-grabbing">
          <div className="flex gap-4 min-h-[600px]" style={{ minWidth: "max-content" }}>
            {STATUSES.map((status) => {
              const statusOrders = orders.filter((o) => o.status === status);
              return (
                <div
                  key={status}
                  className="w-64 flex-shrink-0 flex flex-col bg-muted/10 rounded-2xl p-3 border border-border"
                >
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                      <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
                        {STATUS_LABELS[status]}
                      </h3>
                    </div>
                    <span className="text-xs font-bold bg-background text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                      {statusOrders.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {statusOrders.length === 0 && (
                      <div className="h-24 flex items-center justify-center border-2 border-dashed border-border rounded-xl">
                        <p className="text-xs font-bold text-muted-foreground/50 uppercase">Empty</p>
                      </div>
                    )}

                    {statusOrders.map((order) => {
                      const next = nextStatus(order.status);
                      const packs = getTotalPacks(order.order_items);
                      const cartons = Math.floor(packs / PACKS_PER_CARTON);

                      return (
                        <div
                          key={order.id}
                          className="rounded-xl p-4 border border-border bg-card cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                          onClick={() => handleOpenDrawer(order)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-foreground line-clamp-1 flex-1 pr-2">
                              {order.company?.business_name || "Unknown Company"}
                            </p>
                            <p className="text-xs font-mono font-bold text-muted-foreground uppercase flex-shrink-0">
                              #{order.id.slice(0, 6)}
                            </p>
                          </div>

                          <p className="text-sm font-bold text-foreground mb-3">
                            ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                          </p>

                          <div className="flex gap-3 text-xs font-semibold text-muted-foreground bg-muted/30 p-2 rounded-lg mb-3">
                            <span>📦 {packs} Packs</span>
                            <span>📦 {cartons} Ctns</span>
                          </div>

                          {next && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdvance(order);
                              }}
                              disabled={updating === order.id}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 bg-primary/10 text-primary hover:bg-primary hover:text-white"
                            >
                              {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : "Advance Order"}
                              {updating !== order.id && <ArrowRight size={12} />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* --- SLIDE-OUT PANEL --- */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 border-l border-border flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
                <div>
                  <h2 className="text-lg font-display tracking-wide text-foreground">
                    {selectedOrder.company?.business_name || "Order Details"}
                  </h2>
                  <p className="text-xs font-mono text-muted-foreground mt-1 uppercase">#{selectedOrder.id}</p>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Current Status
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[selectedOrder.status as OrderStatus] }}
                      />
                      <p className="text-sm font-bold text-foreground">
                        {STATUS_LABELS[selectedOrder.status as OrderStatus]}
                      </p>
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Order Value
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      ₹{(selectedOrder.sales_order_value ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Order Items</h3>

                  {drawerLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  ) : drawerItems.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      No items found.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {drawerItems.map((item) => (
                        <div key={item.id} className="p-3 rounded-xl border border-border bg-muted/10">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold text-foreground">{getProductName(item)}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Pack: {item.pack_size ?? "—"} • Ctn: {item.carton_type ?? "—"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                                {item.quantity}x
                              </p>
                              {item.actual_packed_qty != null && item.actual_packed_qty !== item.quantity && (
                                <p className="text-[10px] font-semibold text-muted-foreground mt-1">
                                  Packed: {item.actual_packed_qty}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Total Packs</span>
                    <span className="text-sm font-bold text-foreground">{getTotalPacks(drawerItems)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Total Cartons</span>
                    <span className="text-sm font-bold text-foreground">
                      {Math.floor(getTotalPacks(drawerItems) / PACKS_PER_CARTON)}
                    </span>
                  </div>
                </div>

                {/* ═══ OPERATIONS & ROUTING ═══ */}
                {(selectedOrder.status === "submitted" || selectedOrder.status === "in_production") && !drawerLoading && (
                  <div className="bg-card p-4 rounded-xl border border-border space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <LayoutList size={14} /> Operations & Routing
                    </h3>

                    {reqLoading ? (
                      <div className="py-4 flex justify-center">
                        <Loader2 size={16} className="animate-spin text-primary" />
                      </div>
                    ) : requisitions.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          No store requisitions created yet. Split this order to route items to the correct factory departments.
                        </p>
                        <Button
                          onClick={() => handleAutoSplitOrder(selectedOrder.id, drawerItems)}
                          disabled={splitting || drawerItems.length === 0}
                          className="w-full"
                        >
                          {splitting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Zap size={14} className="mr-2" />}
                          ⚡ Auto-Split & Route to Stores
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {requisitions.map((req: any) => {
                          const itemCount = req.store_requisition_items?.length ?? 0;
                          const storeLabel: Record<string, string> = {
                            ready_goods: "Ready Goods Store",
                            packing_assembly: "Packing & Assembly",
                            "3rd_party": "3rd Party Sourcing",
                          };
                          return (
                            <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${req.status === "pending" ? "bg-amber-400" : req.status === "fulfilled" ? "bg-green-500" : "bg-muted-foreground"}`} />
                                <span className="text-xs font-bold text-foreground">
                                  {storeLabel[req.target_store] || req.target_store}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                                {req.status} ({itemCount} {itemCount === 1 ? "item" : "items"})
                              </span>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-muted-foreground italic">
                          SO-{selectedOrder.id.slice(0, 8).toUpperCase()} routed successfully.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isInProduction && !drawerLoading && drawerItems.length > 0 && (
                  <div className="bg-card p-4 rounded-xl border-2 border-primary/30 space-y-4">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                      <ClipboardList size={14} /> Confirm Packing List
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Verify actual packed quantities before marking ready.
                    </p>

                    <div className="space-y-3">
                      {drawerItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/20">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{getProductName(item)}</p>
                            <p className="text-[10px] text-muted-foreground">Requested: {item.quantity}</p>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={packingQtys[item.id] ?? item.quantity}
                            onChange={(e) =>
                              setPackingQtys(prev => ({ ...prev, [item.id]: Number(e.target.value) || 0 }))
                            }
                            className="w-20 text-center text-sm font-bold"
                          />
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={handleSavePackingList}
                      disabled={packingSaving}
                      className="w-full"
                    >
                      {packingSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Package size={14} className="mr-2" />}
                      Save Packing List & Mark Ready
                    </Button>
                  </div>
                )}

                {/* ═══ FINANCIAL ACTIONS ═══ */}
                <div className="bg-card p-4 rounded-xl border border-border space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <FileText size={14} /> Financial Actions
                  </h3>

                  {/* Stage badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Document Stage:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      selectedOrder.document_stage === "Final" ? "bg-green-100 text-green-700" :
                      selectedOrder.document_stage === "PI" ? "bg-orange-100 text-orange-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {selectedOrder.document_stage === "Final" ? "Final Invoice" :
                       selectedOrder.document_stage === "PI" ? "Proforma Invoice" : "Sales Order"}
                    </span>
                  </div>

                  {/* Generate PI — only visible at packed_ready or later */}
                  {isPackedOrLater && (!selectedOrder.document_stage || selectedOrder.document_stage === "SO") && (
                    <Button
                      onClick={() => handleGeneratePI(selectedOrder.id)}
                      disabled={financeUpdating}
                      className="w-full"
                    >
                      {financeUpdating ? <Loader2 size={14} className="animate-spin mr-2" /> : <FileText size={14} className="mr-2" />}
                      Generate Proforma Invoice (PI)
                    </Button>
                  )}

                  {/* Print / Download PI PDF — only at packed_ready or later */}
                  {isPackedOrLater && (
                    <Button
                      variant="outline"
                      onClick={() => handlePrintInvoice(selectedOrder)}
                      className="w-full"
                    >
                      <Printer size={14} className="mr-2" />
                      Print / Download Proforma PDF
                    </Button>
                  )}

                  {/* Mark Payment Cleared */}
                  {selectedOrder.document_stage === "PI" && !selectedOrder.payment_cleared && (
                    <Button
                      onClick={() => handleMarkPaymentCleared(selectedOrder.id)}
                      disabled={financeUpdating}
                      className="w-full"
                    >
                      {financeUpdating ? <Loader2 size={14} className="animate-spin mr-2" /> : <CheckCircle2 size={14} className="mr-2" />}
                      Mark Payment Cleared
                    </Button>
                  )}

                  {/* E-Way Bill (Final stage) */}
                  {selectedOrder.document_stage === "Final" && (
                    <>
                      {selectedOrder.eway_bill_number ? (
                        <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg">
                          <Truck size={14} className="text-primary" />
                          <span className="text-xs font-semibold text-muted-foreground">E-Way Bill:</span>
                          <span className="text-sm font-bold text-foreground">{selectedOrder.eway_bill_number}</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter E-Way Bill Number"
                            value={ewayInput}
                            onChange={(e) => setEwayInput(e.target.value)}
                            className="flex-1 text-sm"
                          />
                          <Button
                            onClick={() => handleSaveEwayBill(selectedOrder.id)}
                            disabled={financeUpdating}
                            size="sm"
                          >
                            {financeUpdating ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ═══ DISPATCH DOCUMENTS (cleared_for_dispatch) ═══ */}
                {isClearedForDispatch && (
                  <div className="bg-card p-4 rounded-xl border-2 border-accent/40 space-y-4">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                      <Truck size={14} /> Dispatch Documents
                    </h3>

                    {/* E-Way Bill */}
                    {selectedOrder.eway_bill_number ? (
                      <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg">
                        <span className="text-xs font-semibold text-muted-foreground">E-Way Bill:</span>
                        <span className="text-sm font-bold text-foreground">{selectedOrder.eway_bill_number}</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="E-Way Bill Number"
                          value={ewayInput}
                          onChange={(e) => setEwayInput(e.target.value)}
                          className="flex-1 text-sm"
                        />
                        <Button onClick={() => handleSaveEwayBill(selectedOrder.id)} disabled={financeUpdating} size="sm">
                          {financeUpdating ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    )}

                    {/* Gate Pass */}
                    {selectedOrder.gate_pass_number ? (
                      <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg">
                        <span className="text-xs font-semibold text-muted-foreground">Gate Pass:</span>
                        <span className="text-sm font-bold text-foreground">{selectedOrder.gate_pass_number}</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Gate Pass Number"
                          value={gatePassInput}
                          onChange={(e) => setGatePassInput(e.target.value)}
                          className="flex-1 text-sm"
                        />
                        <Button onClick={() => handleSaveGatePass(selectedOrder.id)} disabled={financeUpdating} size="sm">
                          {financeUpdating ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    )}

                    {/* Placeholder print buttons */}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 text-xs" onClick={() => toast.info("Final Tax Invoice generation coming soon")}>
                        <Printer size={12} className="mr-1" /> Print Final Invoice
                      </Button>
                      <Button variant="outline" className="flex-1 text-xs" onClick={() => toast.info("Packing List print coming soon")}>
                        <ClipboardList size={12} className="mr-1" /> Print Packing List
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminOrders;
