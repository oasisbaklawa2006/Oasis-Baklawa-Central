import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Package,
  Clock,
  CheckCircle2,
  ChevronRight,
  X,
  Image as ImageIcon,
  Minus,
  Plus,
  AlertTriangle,
  Hash,
  Store,
  Factory,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TopNavBar from "@/components/TopNavBar";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers"];

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  quantity_ordered: number;
  image_url?: string;
}

interface OperationOrder {
  id: string;
  status: string;
  batch_id: string;
  created_at: string;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  image_url?: string;
}

const OperationsController = () => {
  const [loading, setLoading] = useState(true);
  const [myDepartment, setMyDepartment] = useState("Baklawa");
  const [activeTab, setActiveTab] = useState<"tasks" | "store_log">("tasks");
  const [orders, setOrders] = useState<OperationOrder[]>([]);
  const [departmentProducts, setDepartmentProducts] = useState<Product[]>([]);
  const [activeOrder, setActiveOrder] = useState<OperationOrder | null>(null);
  const [packData, setPackData] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storeLogData, setStoreLogData] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch Orders
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, status, created_at, order_items(id, quantity, product_id, product:products(name, category, image_url))",
      )
      .in("status", ["in_production", "assembly"])
      .order("created_at", { ascending: true });

    if (!orderError && orderData) {
      const formattedOrders: OperationOrder[] = orderData.map((o: any) => ({
        id: o.id,
        status: o.status,
        batch_id: `BATCH-${o.id.split("-")[0].toUpperCase()}`,
        created_at: o.created_at,
        items: o.order_items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || "Unknown Product",
          category: item.product?.category || "Uncategorized",
          quantity_ordered: item.quantity,
          image_url: item.product?.image_url,
        })),
      }));
      setOrders(formattedOrders);
    }

    // 2. Fetch Products
    const { data: prodData } = await supabase.from("products").select("id, name, category, image_url");
    if (prodData) {
      const mappedProducts: Product[] = prodData.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category || "Uncategorized",
        image_url: p.image_url,
      }));
      setDepartmentProducts(mappedProducts);

      const initialStoreData: Record<string, number> = {};
      mappedProducts.forEach((p) => {
        initialStoreData[p.id] = 0;
      });
      setStoreLogData(initialStoreData);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const myDepartmentOrders = orders.filter((order) => order.items.some((item) => item.category === myDepartment));

  const myDepartmentProducts = departmentProducts.filter((p) => p.category === myDepartment);

  const openPackingScreen = (order: OperationOrder) => {
    const initialPack: Record<string, number> = {};
    order.items
      .filter((item) => item.category === myDepartment)
      .forEach((item) => {
        initialPack[item.id] = 0;
      });

    setPackData(initialPack);
    setActiveOrder(order);
  };

  const adjustPack = (itemId: string, delta: number) => {
    setPackData((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) + delta) }));
  };

  const adjustStoreLog = (productId: string, delta: number) => {
    setStoreLogData((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  };

  const handleProcessOrder = async () => {
    if (!activeOrder) return;
    setIsSubmitting(true);

    let isPartial = false;
    let extraToStore = 0;

    activeOrder.items
      .filter((item) => item.category === myDepartment)
      .forEach((item) => {
        const produced = packData[item.id] || 0;
        if (produced < item.quantity_ordered) isPartial = true;
        if (produced > item.quantity_ordered) extraToStore += produced - item.quantity_ordered;
      });

    setTimeout(async () => {
      if (isPartial) {
        toast.warning(`${activeOrder.batch_id}: Partial Fulfillment Logged.`, { icon: "⚠️" });
      } else {
        const targetStatus = activeOrder.status === "in_production" ? "assembly" : "packed_ready";
        await supabase.from("orders").update({ status: targetStatus }).eq("id", activeOrder.id);
        toast.success(`${activeOrder.batch_id}: Department Items Completed!`, { icon: "✅" });
      }

      if (extraToStore > 0) {
        toast.info(`${extraToStore} units routed to Store Inventory.`, { icon: "📦" });
      }

      setActiveOrder(null);
      setIsSubmitting(false);
      fetchData();
    }, 1000);
  };

  const handleLogToStore = () => {
    setIsSubmitting(true);
    let totalLogged = 0;
    Object.values(storeLogData).forEach((val) => {
      totalLogged += val;
    });

    setTimeout(() => {
      toast.success(`${totalLogged} units logged directly to Store Inventory.`, { icon: "🏭" });

      const resetData: Record<string, number> = {};
      myDepartmentProducts.forEach((p) => {
        resetData[p.id] = 0;
      });
      setStoreLogData(resetData);

      setIsSubmitting(false);
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-12 h-12 text-[#B8860B] animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-safe font-sans">
      <TopNavBar />

      <div className="bg-slate-900 text-white pt-24 pb-4 px-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wider uppercase">Floor Tablet</h1>
            <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">Anonymized Production</p>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Locked To</span>
            <select
              value={myDepartment}
              onChange={(e) => setMyDepartment(e.target.value)}
              className="bg-white/10 border border-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg outline-none"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} className="text-black">
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === "tasks" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            <Clock size={14} /> Pending Batches
          </button>
          <button
            onClick={() => setActiveTab("store_log")}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === "store_log" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            <Factory size={14} /> Direct to Store
          </button>
        </div>
      </div>

      {activeTab === "tasks" && (
        <div className="p-4 space-y-3">
          {myDepartmentOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 shadow-sm mt-4">
              <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3 opacity-50" />
              <p className="text-slate-400 font-bold uppercase tracking-widest">No Batches for {myDepartment}</p>
            </div>
          ) : (
            myDepartmentOrders.map((order) => {
              const deptItems = order.items.filter((item) => item.category === myDepartment);
              const isDelayed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 3600000) > 24;

              return (
                <div
                  key={order.id}
                  onClick={() => openPackingScreen(order)}
                  className={`rounded-2xl border-l-8 p-5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer bg-white ${isDelayed ? "border-red-500" : "border-slate-800"}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                        <Hash size={10} /> Priority Batch
                      </p>
                      <h3 className="font-black text-2xl leading-tight text-slate-900">{order.batch_id}</h3>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm font-bold text-[#B8860B] flex items-center gap-1.5">
                      <Package size={16} /> {deptItems.length} Tasks Required
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "store_log" && (
        <div className="p-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
              <Store size={16} /> Continuous Production
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-1">
              Record items produced outside of specific orders. Sends stock directly to Inventory.
            </p>
          </div>

          <div className="space-y-3 mb-24">
            {myDepartmentProducts.length === 0 ? (
              <p className="text-center text-sm font-bold text-slate-400 mt-10">
                No products categorized under {myDepartment} yet.
              </p>
            ) : (
              myDepartmentProducts.map((product) => {
                const qty = storeLogData[product.id] || 0;

                return (
                  <div
                    key={product.id}
                    className={`bg-white rounded-xl p-3 border shadow-sm flex items-center justify-between ${qty > 0 ? "border-emerald-400" : "border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
                        {product.image_url ? (
                          <img src={product.image_url} alt="Product" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={16} className="text-slate-300" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight line-clamp-1">{product.name}</h4>
                        {qty > 0 ? (
                          <p className="text-[10px] font-black text-emerald-600 uppercase">Logging...</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 h-9">
                      <button
                        onClick={() => adjustStoreLog(product.id, -5)}
                        className="w-10 h-full flex items-center justify-center text-slate-500 font-black active:bg-slate-200 rounded-l-lg"
                      >
                        -
                      </button>
                      <span className="font-black text-sm w-10 text-center text-slate-900">{qty}</span>
                      <button
                        onClick={() => adjustStoreLog(product.id, 5)}
                        className="w-10 h-full flex items-center justify-center text-slate-700 font-black active:bg-slate-200 rounded-r-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {Object.values(storeLogData).some((v) => v > 0) && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe z-10">
              <button
                onClick={handleLogToStore}
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest active:scale-95 shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <span>Push To Store Inventory</span>}
              </button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {activeOrder && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-[100dvh]"
          >
            <div className="p-5 flex justify-between items-center text-white bg-slate-900">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{myDepartment} Dept • Task</p>
                <h2 className="text-3xl font-black">{activeOrder.batch_id}</h2>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center active:bg-white/20"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeOrder.items
                .filter((item) => item.category === myDepartment)
                .map((item) => {
                  const produced = packData[item.id] || 0;
                  const target = item.quantity_ordered;
                  const isComplete = produced === target;
                  const isExcess = produced > target;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl p-4 border-2 transition-colors shadow-sm ${isExcess ? "border-purple-500 bg-purple-50/30" : isComplete ? "border-emerald-500 bg-emerald-50/30" : "border-slate-200"}`}
                    >
                      <div className="flex gap-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200">
                          {item.image_url ? (
                            <img src={item.image_url} alt="product" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={24} className="text-slate-300" />
                          )}
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-black text-slate-900 leading-tight text-lg">{item.product_name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500 font-bold">Target: {target}</span>
                              {isExcess ? (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                                  +{produced - target} to Store
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full max-w-[240px]">
                            <button
                              onClick={() => adjustPack(item.id, -1)}
                              className="w-12 h-12 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-slate-700 active:bg-slate-100"
                            >
                              <Minus size={20} />
                            </button>
                            <div className="flex-1 text-center">
                              <span
                                className={`text-3xl font-black ${isExcess ? "text-purple-600" : isComplete ? "text-emerald-600" : "text-slate-900"}`}
                              >
                                {produced}
                              </span>
                            </div>
                            <button
                              onClick={() => adjustPack(item.id, 1)}
                              className={`w-12 h-12 rounded-lg shadow-sm flex items-center justify-center active:scale-95 ${isComplete && !isExcess ? "bg-emerald-100 text-emerald-600 opacity-50" : "bg-slate-900 text-white"}`}
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {(() => {
              let totalProduced = 0;
              let isPartial = false;
              let hasExcess = false;

              activeOrder.items
                .filter((item) => item.category === myDepartment)
                .forEach((item) => {
                  const p = packData[item.id] || 0;
                  totalProduced += p;
                  if (p < item.quantity_ordered) isPartial = true;
                  if (p > item.quantity_ordered) hasExcess = true;
                });

              if (totalProduced === 0) {
                return (
                  <div className="p-4 bg-white border-t border-slate-200 pb-safe">
                    <button
                      disabled
                      className="w-full py-5 rounded-2xl bg-slate-100 text-slate-400 font-black uppercase tracking-widest"
                    >
                      Awaiting Input
                    </button>
                  </div>
                );
              }

              if (isPartial) {
                return (
                  <div className="p-4 bg-white border-t border-slate-200 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2 mb-3 px-1 text-amber-600">
                      <AlertTriangle size={16} />{" "}
                      <p className="text-xs font-bold uppercase tracking-wider">Partial Production</p>
                    </div>
                    <button
                      onClick={handleProcessOrder}
                      disabled={isSubmitting}
                      className="w-full py-5 rounded-2xl bg-amber-500 text-white font-black text-lg uppercase tracking-widest active:scale-95 flex justify-center items-center gap-2"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <span>Log Partial Fulfillment</span>}
                    </button>
                  </div>
                );
              }

              return (
                <div className="p-4 bg-white border-t border-slate-200 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-2 mb-3 px-1 text-emerald-600">
                    <CheckCircle2 size={16} />{" "}
                    <p className="text-xs font-bold uppercase tracking-wider">
                      Target Met {hasExcess ? "& Excess Logged" : ""}
                    </p>
                  </div>
                  <button
                    onClick={handleProcessOrder}
                    disabled={isSubmitting}
                    className="w-full py-5 rounded-2xl bg-[#B8860B] text-white font-black text-lg uppercase tracking-widest active:scale-95 shadow-lg shadow-[#B8860B]/20 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <span>Complete and Sync</span>}
                  </button>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OperationsController;
