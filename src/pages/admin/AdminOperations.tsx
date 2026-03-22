import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings2, Calendar, LayoutGrid, CheckCircle2, PackageSearch, Zap, Wand2 } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers", "Packaging Store"];

interface OpsOrderItem {
  id: string;
  product_id: string;
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
  const [splittingOrder, setSplittingOrder] = useState<string | null>(null);

  // Store State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | "">("");
  const [adjustReason, setAdjustReason] = useState<string>("excess_production");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Factory Task State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskType, setTaskType] = useState("standby");
  const [taskProduct, setTaskProduct] = useState("");
  const [taskQty, setTaskQty] = useState<number | "">("");
  const [taskDept, setTaskDept] = useState("");

  const fetchOpsData = async () => {
    setLoading(true);
    
    const { data: orderData, error } = await supabase
      .from("orders")
      .select(`
        id, status, created_at, dispatch_date,
        order_items (
          id, product_id, quantity, pack_size, carton_type, department, production_status, task_type,
          products ( name )
        )
      `)
      .eq("status", "in_production")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load routing data.");
    } else {
      setOrders((orderData as any[]) || []);
    }

    const { data: productData } = await (supabase as any)
      .from("products")
      .select(`id, name, factory_inventory ( quantity )`);

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

  // --- THE SMART SPLITTER ENGINE ---
  const handleSmartSplit = async (order: OpsOrder) => {
    setSplittingOrder(order.id);
    try {
      let itemsOptimized = 0;

      for (const item of order.order_items || []) {
        if (item.production_status === 'completed') continue;

        const invItem = inventory.find((i) => i.id === item.product_id);
        if (!invItem || invItem.stock <= 0) continue;

        const allocateQty = Math.min(invItem.stock, item.quantity);
        const newStockLevel = invItem.stock - allocateQty;
        const remainingQtyToBake = item.quantity - allocateQty;

        // 1. Deduct from Physical Virtual Store
        await (supabase as any).from("factory_inventory")
          .update({ quantity: newStockLevel })
          .eq("product_id", item.product_id);

        await (supabase as any).from("inventory_adjustments")
          .insert({
            product_id: item.product_id,
            adjustment_type: "smart_fulfillment",
            quantity: -allocateQty,
            notes: `Auto-fulfilled for Order #${order.id.split('-')[0].toUpperCase()}`
          });

        // 2. The Split
        if (remainingQtyToBake === 0) {
          await supabase.from("order_items")
            .update({ production_status: "completed", department: "Ready Goods Store" })
            .eq("id", item.id);
        } else {
          await supabase.from("order_items")
            .update({ quantity: remainingQtyToBake })
            .eq("id", item.id);

          await supabase.from("order_items")
            .insert({
              order_id: order.id,
              product_id: item.product_id,
              quantity: allocateQty,
              pack_size: item.pack_size,
              carton_type: item.carton_type,
              department: "Ready Goods Store", 
              production_status: "completed",
              task_type: item.task_type
            });
        }
        itemsOptimized++;
      }

      if (itemsOptimized > 0) {
        toast.success(`Smart Split complete! Items pulled from Ready Goods.`, { icon: '✨' });
        await fetchOpsData(); 
      } else {
        toast.info("No items could be fulfilled from current stock.");
      }
    } catch (error) {
      toast.error("Error during Smart Split.");
      console.error(error);
    }
    setSplittingOrder(null);
  };

  const handleAssignDepartment = async (itemId: string, department: string) => {
    const { error } = await supabase
      .from("order_items")
      .update({ department: department, production_status: "pending" })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to assign department");
    } else {
      toast.success(`Item routed to ${department}`);
      fetchOpsData();
    }
  };

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

      await (supabase as any)
        .from("inventory_adjustments")
        .insert({
          product_id: adjustingProduct.id,
          adjustment_type: adjustReason,
          quantity: amount,
          notes: adjustNotes || "Manual Ops adjustment"
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

  const handleCreateTask = async () => {
    if (!taskProduct || !taskDept || !taskQty) {
      toast.error("Please fill in all task details.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: orderData, error: orderError } = await (supabase as any)
        .from("orders")
        .insert({ status: "in_production", sales_order_value: 0 })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { error: itemError } = await (supabase as any)
        .from("order_items")
        .insert({
          order_id: orderData.id,
          product_id: taskProduct,
          quantity: taskQty,
          department: taskDept,
          production_status: "pending",
          task_type: taskType
        });

      if (itemError) throw itemError;

      toast.success("Task beamed to factory TV!", { icon: "🚀" });
      setIsTaskModalOpen(false);
      setTaskProduct("");
      setTaskQty("");
      setTaskDept("");
      fetchOpsData();
    } catch (error) {
      toast.error("Failed to beam task.");
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
      day: "numeric", month: "short", year: "numeric",
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
              <Settings2 size={16} /> Operations Head
            </div>
            <h1 className="text-2xl font-bold text-foreground">Factory Control</h1>
            <p className="text-sm text-muted-foreground mt-1">Route materials and manage physical inventory.</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsTaskModalOpen(true)} 
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95"
            >
              <Zap size={16} className="text-amber-400" /> Beam Task
            </button>

            <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
              <button 
                onClick={() => setActiveTab("routing")} 
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "routing" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid size={16} /> Routing
              </button>
              <button 
                onClick={() => setActiveTab("store")} 
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "store" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
              >
                <PackageSearch size={16} /> Ready Goods
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: ROUTING */}
        {activeTab === "routing" && (
          orders.length === 0 ? (
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
                const isInternalTask = order.order_items?.some((i) => i.task_type === "standby" || i.task_type === "interdepartmental");

                // Check if any item in this order can be fulfilled from stock
                const canBeOptimized = !isInternalTask && order.order_items?.some((item) => {
                  if (item.production_status === 'completed') return false;
                  const stockAvailable = inventory.find((i) => i.id === item.product_id)?.stock || 0;
                  return stockAvailable > 0;
                });

                return (
                  <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                    <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">{isInternalTask ? "Internal Dispatch Auth" : "Factory Order ID"}</p>
                        <p className="text-lg font-bold text-foreground">
                          {isInternalTask ? "AUTO-GENERATED" : `#${order.id.split("-")[0].toUpperCase()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        
                        {/* THE SMART SPLIT BUTTON */}
                        {canBeOptimized && (
                          <button
                            onClick={() => handleSmartSplit(order)}
                            disabled={splittingOrder === order.id}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {splittingOrder === order.id ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                            Auto-Fill from Store
                          </button>
                        )}

                        {!isInternalTask && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar size={12} />
                            Dispatch: {formatDate(order.dispatch_date || order.created_at)}
                          </span>
                        )}

                        {isFullyRouted && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                            <CheckCircle2 size={14} /> Fully Routed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground flex items-center gap-2">
                              {getProductName(item)}
                              {item.task_type === "standby" && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Standby</span>}
                              {item.task_type === "interdepartmental" && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Internal</span>}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                              <span>Qty: <strong className="text-foreground">{item.quantity}</strong></span>
                              <span>Pack: {item.pack_size || "Standard"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.production_status === "completed" ? (
                              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 w-full sm:w-48 justify-center">
                                <CheckCircle2 size={14} /> {item.department === "Ready Goods Store" ? "Pulled from Store" : "Done"}
                              </span>
                            ) : (
                              <select
                                value={item.department || ""}
                                onChange={(e) => handleAssignDepartment(item.id, e.target.value)}
                                className={`flex-1 sm:w-48 px-3 py-2.5 rounded-lg text-sm font-semibold border outline-none transition-colors ${
                                  item.department ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-primary"
                                }`}
                              >
                                <option value="">Route to Dept...</option>
                                {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* TAB 2: STORE */}
        {activeTab === "store" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="text-lg font-bold text-foreground">Physical Inventory</h2>
              <p className="text-sm text-muted-foreground">Adjust levels for the Ready Goods Store.</p>
            </div>
            <div className="divide-y divide-border">
              {inventory.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className={`text-sm mt-1 ${item.stock > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>{item.stock} in stock</p>
                  </div>
                  <button onClick={() => setAdjustingProduct(item)} className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-semibold transition-colors">Adjust</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FACTORY TASK MODAL */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 border border-border shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={20} className="text-amber-500" />
                <h3 className="text-lg font-bold">Beam Factory Task</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Send a direct order to a department TV.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Priority / Task Type</label>
                  <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background text-sm font-semibold outline-none">
                    <option value="interdepartmental">🟡 Priority 2: Internal Assembly</option>
                    <option value="standby">🟢 Priority 3: Standby (Stock Fill)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Product</label>
                  <select value={taskProduct} onChange={(e) => setTaskProduct(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none">
                    <option value="">Select a product...</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                    <input type="number" min="1" value={taskQty} onChange={(e) => setTaskQty(Number(e.target.value))} placeholder="0" className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Target Dept.</label>
                    <select value={taskDept} onChange={(e) => setTaskDept(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none">
                      <option value="">Select...</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-2.5 rounded-lg font-semibold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors text-sm">Cancel</button>
                <button onClick={handleCreateTask} disabled={isSubmitting} className="flex-1 py-2.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-colors text-sm flex items-center justify-center">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Beam to TV"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADJUST STOCK MODAL */}
        {adjustingProduct && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 border border-border shadow-lg">
              <h3 className="text-lg font-bold mb-1">Adjust {adjustingProduct.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">Current: <span className="font-bold text-foreground">{adjustingProduct.stock}</span></p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type of Adjustment</label>
                  <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none">
                    <option value="excess_production">➕ Add (Excess Production)</option>
                    <option value="manual_correction">➕ Add (Manual Correction)</option>
                    <option value="wastage">➖ Remove (Wastage/Spoiled)</option>
                    <option value="damage">➖ Remove (Damaged)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                  <input type="number" min="1" value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value))} className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none" placeholder="Amount" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notes (Optional)</label>
                  <input type="text" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none" placeholder="Details" />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAdjustingProduct(null)} className="flex-1 py-2.5 rounded-lg font-semibold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors text-sm">Cancel</button>
                <button onClick={handleAdjustStock} disabled={isSubmitting} className="flex-1 py-2.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-colors text-sm flex items-center justify-center">
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

export default AdminOperations;  const [activeTab, setActiveTab] = useState<"routing" | "store">("routing");

  // Routing State
  const [orders, setOrders] = useState<OpsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [splittingOrder, setSplittingOrder] = useState<string | null>(null);

  // Store State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | "">("");
  const [adjustReason, setAdjustReason] = useState<string>("excess_production");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Factory Task State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskType, setTaskType] = useState("standby");
  const [taskProduct, setTaskProduct] = useState("");
  const [taskQty, setTaskQty] = useState<number | "">("");
  const [taskDept, setTaskDept] = useState("");

  const fetchOpsData = async () => {
    setLoading(true);
    
    const { data: orderData, error } = await supabase
      .from("orders")
      .select(`
        id, status, created_at, dispatch_date,
        order_items (
          id, product_id, quantity, pack_size, carton_type, department, production_status, task_type,
          products ( name )
        )
      `)
      .eq("status", "in_production")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load routing data.");
    } else {
      setOrders((orderData as any[]) || []);
    }

    const { data: productData } = await (supabase as any)
      .from("products")
      .select(`id, name, factory_inventory ( quantity )`);

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

  // --- THE SMART SPLITTER ENGINE ---
  const handleSmartSplit = async (order: OpsOrder) => {
    setSplittingOrder(order.id);
    try {
      let itemsOptimized = 0;

      for (const item of order.order_items || []) {
        if (item.production_status === 'completed') continue;

        const invItem = inventory.find(i => i.id === item.product_id);
        if (!invItem || invItem.stock <= 0) continue;

        const allocateQty = Math.min(invItem.stock, item.quantity);
        const newStockLevel = invItem.stock - allocateQty;
        const remainingQtyToBake = item.quantity - allocateQty;

        // 1. Deduct from Physical Virtual Store
        await (supabase as any).from("factory_inventory")
          .update({ quantity: newStockLevel })
          .eq("product_id", item.product_id);

        await (supabase as any).from("inventory_adjustments")
          .insert({
            product_id: item.product_id,
            adjustment_type: "smart_fulfillment",
            quantity: -allocateQty,
            notes: `Auto-fulfilled for Order #${order.id.split('-')[0].toUpperCase()}`
          });

        // 2. The Split
        if (remainingQtyToBake === 0) {
          await supabase.from("order_items")
            .update({ production_status: "completed", department: "Ready Goods Store" })
            .eq("id", item.id);
        } else {
          await supabase.from("order_items")
            .update({ quantity: remainingQtyToBake })
            .eq("id", item.id);

          await supabase.from("order_items")
            .insert({
              order_id: order.id,
              product_id: item.product_id,
              quantity: allocateQty,
              pack_size: item.pack_size,
              carton_type: item.carton_type,
              department: "Ready Goods Store", 
              production_status: "completed",
              task_type: item.task_type
            });
        }
        itemsOptimized++;
      }

      if (itemsOptimized > 0) {
        toast.success      .select(`
        id, order_id, quantity, pack_size, carton_type, production_status,
        products ( name ),
        orders ( id, created_at, status )
      `)
      .eq("department", activeDept)
      .eq("production_status", "pending");

    if (error) {
      console.error("Fetch Error:", error);
      toast.error(`Error: ${error.message}`);
    } else {
      // Filter out items where the parent order isn't active
      const validItems = (data as any[]).filter(
        item => item.orders?.status === "in_production" || item.orders?.status === "assembly"
      );
      setItems(validItems);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartmentItems();
  }, [activeDept]); 

  const handleMarkCompleted = async (itemId: string, orderId: string) => {
    setCompletingId(itemId);

    try {
      // 1. Mark this specific item as completed
      const { error: itemError } = await supabase
        .from("order_items")
        .update({ production_status: "completed" })
        .eq("id", itemId);

      if (itemError) throw itemError;

      toast.success("Item marked as completed!");

      // 2. Remove it from the TV screen immediately
      setItems(current => current.filter(i => i.id !== itemId));

      // 3. THE MAGIC: Check if the entire order is now finished
      const { data: siblingItems } = await supabase
        .from("order_items")
        .select("production_status")
        .eq("order_id", orderId);

      const isEntireOrderDone = siblingItems?.every(
        (item) => item.production_status === "completed"
      );

      // If every single item in this order is done, auto-push the master order to packing!
      if (isEntireOrderDone) {
        await supabase
          .from("orders")
          .update({ status: "packing" })
          .eq("id", orderId);
        
        await supabase
          .from("order_status_history")
          .insert({ order_id: orderId, old_status: "in_production", new_status: "packing" });
          
        toast.success(`Factory Order #${orderId.split('-')[0].toUpperCase()} is fully prepped and sent to Packing!`, {
          duration: 5000,
          icon: '🎉'
        });
      }

    } catch (error) {
      console.error("Completion Error:", error);
      toast.error("Failed to update status.");
    } finally {
      setCompletingId(null);
    }
  };

  const getProductName = (item: any) => {
    if (item.products?.name) return item.products.name;
    if (item.product?.name) return item.product.name;
    return "Unknown Item";
  };

  // Group items by Order ID so the kitchen sees them organized by ticket
  const groupedItems = items.reduce((acc, item) => {
    const key = item.order_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, DeptItem[]>);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <TopNavBar />
      
      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        
        {/* Kiosk Header & Dept Selector */}
        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-3 rounded-2xl">
              <MonitorPlay size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900">Floor Kiosk</h1>
              <p className="text-sm text-slate-500 font-medium">Live production queue</p>
            </div>
          </div>
          
          <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {DEPARTMENTS.map(dept => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`whitespace-nowrap px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeDept === dept 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={48} className="animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm">
            <ChefHat size={64} className="mx-auto text-slate-200 mb-6" />
            <h3 className="text-2xl font-display font-bold text-slate-900">Queue is clear</h3>
            <p className="text-slate-500 mt-2 text-lg">No pending items for {activeDept}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedItems).map(([orderId, orderItems]) => {
              // Fallback to created_at since dispatch_date doesn't exist yet
              const orderDate = orderItems[0].orders?.created_at;
              const formattedDate = orderDate ? new Intl.DateTimeFormat('en-IN', {
                day: 'numeric', month: 'short'
              }).format(new Date(orderDate)) : 'TBD';

              return (
                <div key={orderId} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                  
                  {/* Blind Order Header */}
                  <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Factory Order</p>
                      <p className="font-mono text-xl font-bold">#{orderId.split('-')[0].toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Order Date</p>
                      <p className="font-bold flex items-center justify-end gap-1.5">
                        <Clock size={14} className="text-amber-400" /> {formattedDate}
                      </p>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="p-4 space-y-3">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="w-full sm:w-auto flex-1">
                          <h3 className="text-xl font-bold text-slate-900 mb-2">{getProductName(item)}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold">
                              {item.quantity}x Units
                            </span>
                            <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-sm font-medium">
                              {item.pack_size || "Standard"}
                            </span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleMarkCompleted(item.id, item.order_id)}
                          disabled={completingId === item.id}
                          className="w-full sm:w-auto active:scale-95 transition-transform flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                        >
                          {completingId === item.id ? (
                            <Loader2 size={24} className="animate-spin" />
                          ) : (
                            <>
                              <CheckSquare size={24} />
                              COMPLETE
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDepartment;
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

  // Factory Task State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskType, setTaskType] = useState("standby");
  const [taskProduct, setTaskProduct] = useState("");
  const [taskQty, setTaskQty] = useState<number | "">("");
  const [taskDept, setTaskDept] = useState("");

  const fetchOpsData = async () => {
    setLoading(true);

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

    const { data: productData } = await (supabase as any)
      .from("products")
      .select(`id, name, factory_inventory ( quantity )`);

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

  const handleAssignDepartment = async (itemId: string, department: string) => {
    const { error } = await supabase
      .from("order_items")
      .update({ department: department, production_status: "pending" })
      .eq("id", itemId);

    if (error) toast.error("Failed to assign department");
    else {
      toast.success(`Item routed to ${department}`);
      fetchOpsData();
    }
  };

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

  const handleCreateTask = async () => {
    if (!taskProduct || !taskDept || !taskQty) {
      toast.error("Please fill in all task details.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create a "Phantom Order" to hold the internal task
      const { data: orderData, error: orderError } = await (supabase as any)
        .from("orders")
        .insert({ status: "in_production", sales_order_value: 0 })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 2. Insert the item and route it directly to the TV screen
      const { error: itemError } = await (supabase as any).from("order_items").insert({
        order_id: orderData.id,
        product_id: taskProduct,
        quantity: taskQty,
        department: taskDept,
        production_status: "pending",
        task_type: taskType,
      });

      if (itemError) throw itemError;

      toast.success("Task beamed to factory TV!", { icon: "🚀" });
      setIsTaskModalOpen(false);
      setTaskProduct("");
      setTaskQty("");
      setTaskDept("");
      fetchOpsData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to beam task.");
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

          <div className="flex items-center gap-3">
            {/* THE NEW BEAM TASK BUTTON */}
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95"
            >
              <Zap size={16} className="text-amber-400" />
              Beam Task
            </button>

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
                const isInternalTask = order.order_items?.some(
                  (i) => i.task_type === "standby" || i.task_type === "interdepartmental",
                );

                return (
                  <div
                    key={order.id}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                    style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
                  >
                    <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {isInternalTask ? "Internal Dispatch Auth" : "Factory Order ID"}
                        </p>
                        <p className="text-lg font-bold text-foreground">
                          {isInternalTask ? "AUTO-GENERATED" : `#${order.id.split("-")[0].toUpperCase()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {!isInternalTask && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar size={12} />
                            Dispatch: {formatDate(order.dispatch_date || order.created_at)}
                          </span>
                        )}
                        {isFullyRouted && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle2 size={14} /> Fully Routed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground flex items-center gap-2">
                              {getProductName(item)}
                              {item.task_type === "standby" && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  Standby
                                </span>
                              )}
                              {item.task_type === "interdepartmental" && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
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

        {/* FACTORY TASK MODAL (NEW) */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 border border-border shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={20} className="text-amber-500" />
                <h3 className="text-lg font-bold">Beam Factory Task</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Send a direct order to a department TV.</p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Priority / Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm font-semibold outline-none"
                  >
                    <option value="interdepartmental">🟡 Priority 2: Internal Assembly</option>
                    <option value="standby">🟢 Priority 3: Standby (Stock Fill)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Product</label>
                  <select
                    value={taskProduct}
                    onChange={(e) => setTaskProduct(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none"
                  >
                    <option value="">Select a product...</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={taskQty}
                      onChange={(e) => setTaskQty(Number(e.target.value))}
                      placeholder="0"
                      className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Target Dept.</label>
                    <select
                      value={taskDept}
                      onChange={(e) => setTaskDept(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-border bg-background text-sm outline-none"
                    >
                      <option value="">Select...</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsTaskModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-colors text-sm flex items-center justify-center"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Beam to TV"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADJUST STOCK MODAL */}
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
