import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings2, Calendar, LayoutGrid, CheckCircle2, PackageSearch } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers", "Packaging Store"];

interface OpsOrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  department: string | null;
  production_status: string | null;
  task_type?: string | null;
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

  const fetchOpsData = async () => {
    setLoading(true);

    // 1. Fetch Routing Orders
    const { data: orderData, error } = await supabase
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

    if (error) {
      toast.error("Failed to load routing data.");
    } else {
      setOrders((orderData as any[]) || []);
    }

    // 2. Fetch Ready Goods Store (Bypassing strict TS for new table)
    const { data: productData } = await (supabase as any).from("products").select(`
        id, name,
        factory_inventory ( quantity )
      `);

    if (productData) {
      const formattedInventory = productData.map((p: any) => ({
        id: p.id,
        name: p.name,
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
      .update({
        department: department,
        production_status: "pending",
      })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to assign department");
    } else {
      toast.success(`Item routed to ${department}`);
      fetchOpsData(); // Silent refresh to sync
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
    const isDeduction = adjustReason === "wastage" || adjustReason === "damage";
    const changeAmount = isDeduction ? -amount : amount;
    const newStockLevel = adjustingProduct.stock + changeAmount;

    if (newStockLevel < 0) {
      toast.error("Stock cannot fall below zero!");
      setIsSubmitting(false);
      return;
    }

    try {
      // Bypassing strict TS for the new factory_inventory table
      const { data: existingStock } = await (supabase as any)
        .from("factory_inventory")
        .select("id")
        .eq("product_id", adjustingProduct.id)
        .single();

      if (existingStock) {
        await (supabase as any)
          .from("factory_inventory")
          .update({ quantity: newStockLevel, last_updated: new Date().toISOString() })
          .eq("product_id", adjustingProduct.id);
      } else {
        await (supabase as any)
          .from("factory_inventory")
          .insert({ product_id: adjustingProduct.id, quantity: newStockLevel });
      }

      // Bypassing strict TS for the new inventory_adjustments table
      await (supabase as any).from("inventory_adjustments").insert({
        product_id: adjustingProduct.id,
        adjustment_type: adjustReason,
        quantity: amount,
        notes: adjustNotes || "Manual Ops adjustment",
      });

      toast.success("Ready Goods Store updated");
      setAdjustingProduct(null);
      setAdjustAmount("");
      setAdjustNotes("");
      fetchOpsData();
    } catch (error) {
      toast.error("Failed to update inventory.");
    }
    setIsSubmitting(false);
  };

  const getProductName = (item: OpsOrderItem) => {
    if (item.products?.name) return item.products.name;
    if (item.product?.name) return item.product.name;
    return "Unknown Item";
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
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
        {/* Header & Tabs Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Settings2 size={16} />
              Operations Head
            </div>
            <h1 className="text-2xl font-bold text-foreground">Factory Control</h1>
            <p className="text-sm text-muted-foreground mt-1">Route materials and manage physical inventory.</p>
          </div>

          <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("routing")}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "routing"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={16} /> Routing
            </button>
            <button
              onClick={() => setActiveTab("store")}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "store"
                  ? "bg-background text-foreground shadow-sm border border-border"
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
            <div className="text-center py-16 space-y-3">
              <LayoutGrid size={40} className="mx-auto text-muted-foreground/40" />
              <p className="text-lg font-semibold text-foreground">No active operations</p>
              <p className="text-sm text-muted-foreground">There are currently no orders in the production queue.</p>
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
                    className="bg-card border border-border rounded-xl overflow-hidden"
                    style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
                  >
                    {/* Order Header */}
                    <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Factory Order ID</p>
                        <p className="text-lg font-bold text-foreground">#{order.id.split("-")[0].toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar size={12} />
                          Dispatch: {formatDate(order.dispatch_date || order.created_at)}
                        </span>
                        {isFullyRouted && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle2 size={14} /> Fully Routed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items Routing List */}
                    <div className="divide-y divide-border">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          {/* Item Details */}
                          <div className="flex-1">
                            <p className="font-semibold text-foreground flex items-center gap-2">
                              {getProductName(item)}
                              {item.task_type === "standby" && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  Standby
                                </span>
                              )}
                              {item.task_type === "interdepartmental" && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  Internal
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                              <span>Qty: {item.quantity}</span>
                              <span>Pack: {item.pack_size || "Standard"}</span>
                              <span>Carton: {item.carton_type || "Standard"}</span>
                            </div>
                          </div>

                          {/* Status & Routing Dropdown */}
                          <div className="flex items-center gap-2">
                            {item.production_status === "completed" && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                                <CheckCircle2 size={14} /> Done
                              </span>
                            )}
                            <select
                              value={item.department || ""}
                              onChange={(e) => handleAssignDepartment(item.id, e.target.value)}
                              disabled={item.production_status === "completed"}
                              className={`flex-1 sm:w-48 px-3 py-2.5 rounded-lg text-sm font-semibold border outline-none transition-colors ${
                                item.department
                                  ? "bg-foreground text-background border-foreground"
                                  : "bg-background text-muted-foreground border-border hover:border-primary focus:ring-2 focus:ring-primary/20"
                              }`}
                            >
                              <option value="">Route to Dept...</option>
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

        {/* TAB 2: STORE */}
        {activeTab === "store" && (
          <div
            className="bg-card border border-border rounded-xl overflow-hidden"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="text-lg font-bold text-foreground">Physical Inventory</h2>
              <p className="text-sm text-muted-foreground">Adjust levels for the Ready Goods Store.</p>
            </div>

            <div className="divide-y divide-border">
              {inventory.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p
                      className={`text-sm mt-1 ${item.stock > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}`}
                    >
                      {item.stock} in stock
                    </p>
                  </div>
                  <button
                    onClick={() => setAdjustingProduct(item)}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-semibold transition-colors"
                  >
                    Adjust
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL */}
        {adjustingProduct && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 border border-border shadow-lg">
              <h3 className="text-lg font-bold mb-1">Adjust {adjustingProduct.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Current: <span className="font-bold text-foreground">{adjustingProduct.stock}</span>
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type of Adjustment</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none"
                  >
                    <option value="excess_production">➕ Add (Excess Production)</option>
                    <option value="manual_correction">➕ Add (Manual Correction)</option>
                    <option value="wastage">➖ Remove (Wastage/Spoiled)</option>
                    <option value="damage">➖ Remove (Damaged)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Optional details"
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAdjustingProduct(null)}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustStock}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-colors text-sm flex items-center justify-center"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Save"}
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
