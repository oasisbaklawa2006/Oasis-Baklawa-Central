import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Settings2,
  Calendar,
  LayoutGrid,
  CheckCircle2,
  PackageSearch,
  AlertTriangle,
  Plus,
  Minus,
} from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers", "Packaging Store"];

interface OpsOrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  department: string | null;
  production_status: string | null;
  task_type?: string;
  products?: { name: string } | null;
  product?: { name: string } | null;
}

interface OpsOrder {
  id: string;
  status: string;
  created_at: string;
  dispatch_date?: string | null;
  order_items?: OpsOrderItem[];
}

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
}

const AdminOperations = () => {
  const [activeTab, setActiveTab] = useState<"routing" | "store">("routing");

  // Routing State
  const [orders, setOrders] = useState<OpsOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Store State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | "">("");
  const [adjustReason, setAdjustReason] = useState<string>("excess_production");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FETCH DATA ---
  const fetchOpsData = async () => {
    setLoading(true);

    // 1. Fetch Routing Orders
    const { data: orderData } = await supabase
      .from("orders")
      .select(
        `
        id, status, created_at,
        order_items (
          id, quantity, pack_size, carton_type, department, production_status, task_type,
          products ( name )
        )
      `,
      )
      .eq("status", "in_production")
      .order("created_at", { ascending: true });

    setOrders((orderData as any[]) || []);

    // 2. Fetch Ready Goods Store (Products + Inventory)
    const { data: productData } = await supabase.from("products").select(`
        id, name,
        factory_inventory ( quantity )
      `);

    if (productData) {
      const formattedInventory = productData.map((p: any) => ({
        id: p.id,
        name: p.name,
        // Safely extract quantity if the row exists, otherwise default to 0
        stock: p.factory_inventory?.[0]?.quantity || 0,
      }));
      setInventory(formattedInventory);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchOpsData();
  }, []);

  // --- ROUTING ACTIONS ---
  const handleAssignDepartment = async (itemId: string, department: string) => {
    const { error } = await supabase
      .from("order_items")
      .update({ department: department, production_status: "pending" })
      .eq("id", itemId);

    if (error) toast.error("Failed to assign department");
    else {
      toast.success(`Item routed to ${department}`);
      fetchOpsData(); // Refresh to ensure sync
    }
  };

  // --- STORE ACTIONS ---
  const handleAdjustStock = async () => {
    if (!adjustingProduct || adjustAmount === "" || Number(adjustAmount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsSubmitting(true);
    const amount = Number(adjustAmount);
    // If it's wastage/damage, we subtract. If excess, we add.
    const isDeduction = adjustReason === "wastage" || adjustReason === "damage";
    const changeAmount = isDeduction ? -amount : amount;
    const newStockLevel = adjustingProduct.stock + changeAmount;

    if (newStockLevel < 0) {
      toast.error("Stock cannot fall below zero!");
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Update or Insert into factory_inventory
      const { data: existingStock } = await supabase
        .from("factory_inventory")
        .select("id")
        .eq("product_id", adjustingProduct.id)
        .single();

      if (existingStock) {
        await supabase
          .from("factory_inventory")
          .update({ quantity: newStockLevel, last_updated: new Date().toISOString() })
          .eq("product_id", adjustingProduct.id);
      } else {
        await supabase.from("factory_inventory").insert({ product_id: adjustingProduct.id, quantity: newStockLevel });
      }

      // 2. Log the adjustment in inventory_adjustments
      await supabase.from("inventory_adjustments").insert({
        product_id: adjustingProduct.id,
        adjustment_type: adjustReason,
        quantity: amount,
        notes: adjustNotes || "Manual adjustment by Ops Head",
      });

      toast.success("Ready Goods Store updated!");
      setAdjustingProduct(null);
      setAdjustAmount("");
      setAdjustNotes("");
      fetchOpsData(); // Refresh the list
    } catch (error) {
      console.error(error);
      toast.error("Failed to update inventory.");
    }
    setIsSubmitting(false);
  };

  const getProductName = (item: any) => {
    if (item.products?.name) return item.products.name;
    if (item.product?.name) return item.product.name;
    return "Unknown Item";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Settings2 size={20} />
              <span className="font-bold text-sm tracking-widest uppercase">Operations Head</span>
            </div>
            <h1 className="text-display-h1 text-foreground">Factory Control</h1>
            <p className="text-body-p2 text-muted-foreground mt-1">Route materials and manage the Ready Goods Store.</p>
          </div>

          {/* TABS */}
          <div className="flex bg-muted/30 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("routing")}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === "routing"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={16} /> Routing
            </button>
            <button
              onClick={() => setActiveTab("store")}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === "store"
                  ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PackageSearch size={16} /> Ready Goods
            </button>
          </div>
        </div>

        {/* TAB 1: ROUTING */}
        {activeTab === "routing" &&
          (orders.length === 0 ? (
            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border border-dashed border-border">
              <CheckCircle2 size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold text-foreground">No active operations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                There are currently no orders in the production queue.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const totalItems = order.order_items?.length || 0;
                const assignedItems = order.order_items?.filter((i) => i.department).length || 0;
                const isFullyRouted = totalItems > 0 && assignedItems === totalItems;

                return (
                  <div
                    key={order.id}
                    className={`bg-card rounded-[2rem] border p-6 shadow-sm transition-all ${isFullyRouted ? "border-emerald-500/30 bg-emerald-50/10" : "border-border"}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          Factory Order ID
                        </p>
                        <p className="font-mono text-xl font-bold text-foreground">
                          #{order.id.split("-")[0].toUpperCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        {isFullyRouted && (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                            <CheckCircle2 size={14} /> Fully Routed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {order.order_items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border"
                        >
                          <div className="flex-1">
                            <p className="font-bold text-foreground text-base mb-1">
                              {getProductName(item)}
                              {item.task_type === "standby" && (
                                <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">
                                  Standby Stock
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                                Qty: {item.quantity}
                              </span>
                              <span>Pack: {item.pack_size || "Standard"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            {item.production_status === "completed" && (
                              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 size={14} /> Done
                              </span>
                            )}
                            <select
                              value={item.department || ""}
                              onChange={(e) => handleAssignDepartment(item.id, e.target.value)}
                              disabled={item.production_status === "completed"}
                              className={`flex-1 sm:w-48 px-3 py-2.5 rounded-lg text-sm font-semibold border outline-none transition-colors ${
                                item.department
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white text-slate-600 border-slate-200"
                              }`}
                            >
                              <option value="" disabled>
                                Route to Dept...
                              </option>
                              {DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* TAB 2: READY GOODS STORE */}
        {activeTab === "store" && (
          <div className="bg-card rounded-[2rem] border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/10">
              <h2 className="text-xl font-display font-bold text-foreground">Inventory Levels</h2>
              <p className="text-sm text-muted-foreground">Current physical stock sitting in the Ready Goods Room.</p>
            </div>

            <div className="divide-y divide-border">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:px-6 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="font-bold text-foreground">{item.name}</p>
                    <p
                      className={`text-sm font-semibold mt-1 ${item.stock > 0 ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      {item.stock} in stock
                    </p>
                  </div>
                  <button
                    onClick={() => setAdjustingProduct(item)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:border-primary hover:text-primary transition-colors"
                  >
                    Adjust Stock
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADJUSTMENT MODAL */}
        {adjustingProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background w-full max-w-md rounded-[2rem] p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95">
              <h3 className="text-xl font-display font-bold mb-1">Adjust {adjustingProduct.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Current Stock: <span className="font-bold text-foreground">{adjustingProduct.stock}</span>
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Reason</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white font-medium outline-none focus:border-primary"
                  >
                    <option value="excess_production">➕ Add Excess Production</option>
                    <option value="manual_correction">➕ Add (Manual Count Correction)</option>
                    <option value="wastage">➖ Remove (Wastage / Spoiled)</option>
                    <option value="damage">➖ Remove (Damaged in Transit/Floor)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                    Quantity Change
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white font-medium outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Dropped tray"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white font-medium outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAdjustingProduct(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustStock}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-black transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Save Adjustment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminOperations;
