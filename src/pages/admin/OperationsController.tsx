import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

const DEPARTMENTS: { value: string; label: string }[] = [
  { value: "arabic_sweets", label: "Arabic Sweets" },
  { value: "dragees", label: "Dragees" },
  { value: "fusion_sweets", label: "Fusion Sweets" },
  { value: "chocolate", label: "Chocolate" },
  { value: "bakery", label: "Bakery" },
  { value: "nuts_mixes", label: "Nuts & Mixes" },
  { value: "ready_goods", label: "Ready Goods" },
  { value: "packing_assembly", label: "Packing & Assembly" },
];

interface RequisitionItem {
  id: string;
  product_id: string;
  product_name: string;
  image_url?: string;
  requested_qty: number;
}

interface Requisition {
  id: string;
  order_id: string;
  batch_id: string;
  status: string;
  created_at: string;
  items: RequisitionItem[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  image_url?: string;
}

const OperationsController = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myDepartment, setMyDepartment] = useState("arabic_sweets");
  const [activeTab, setActiveTab] = useState<"tasks" | "store_log">("tasks");
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [departmentProducts, setDepartmentProducts] = useState<Product[]>([]);
  const [activeRequisition, setActiveRequisition] = useState<Requisition | null>(null);
  const [packData, setPackData] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storeLogData, setStoreLogData] = useState<Record<string, number>>({});
  const [wastageData, setWastageData] = useState<Record<string, number>>({});

  // Panic Button State
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicProductId, setPanicProductId] = useState("");
  const [panicQty, setPanicQty] = useState("");
  const [panicSubmitting, setPanicSubmitting] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const deptLabel = DEPARTMENTS.find((d) => d.value === myDepartment)?.label || myDepartment;

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch pending store_requisitions for this department
    const { data: reqData, error: reqError } = await supabase
      .from("store_requisitions")
      .select("id, order_id, status, created_at, store_requisition_items(id, product_id, requested_qty, product:products(name, image_url))")
      .eq("target_store", myDepartment)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!reqError && reqData) {
      const formatted: Requisition[] = (reqData as any[]).map((r) => ({
        id: r.id,
        order_id: r.order_id,
        batch_id: `REQ-${r.id.split("-")[0].toUpperCase()}`,
        status: r.status,
        created_at: r.created_at,
        items: (r.store_requisition_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || "Unknown Product",
          image_url: item.product?.image_url,
          requested_qty: item.requested_qty,
        })),
      }));
      setRequisitions(formatted);
    }

    // 2. Fetch Products for store log (filter by production_department matching myDepartment)
    const { data: prodData } = await supabase
      .from("products")
      .select("id, name, category, image_url, production_department")
      .eq("is_active", true);

    if (prodData) {
      // Store all products for panic modal
      const allMapped: Product[] = (prodData as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || "Uncategorized",
        image_url: p.image_url,
      }));
      setAllProducts(allMapped);

      const mappedProducts: Product[] = (prodData as any[])
        .filter((p) => (p.production_department || "").toLowerCase() === myDepartment)
        .map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category || "Uncategorized",
          image_url: p.image_url,
        }));
      setDepartmentProducts(mappedProducts);

      const initialStoreData: Record<string, number> = {};
      const initialWastageData: Record<string, number> = {};
      mappedProducts.forEach((p) => {
        initialStoreData[p.id] = 0;
        initialWastageData[p.id] = 0;
      });
      setStoreLogData(initialStoreData);
      setWastageData(initialWastageData);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [myDepartment]);

  const openPackingScreen = (req: Requisition) => {
    const initialPack: Record<string, number> = {};
    req.items.forEach((item) => {
      initialPack[item.id] = 0;
    });
    setPackData(initialPack);
    setActiveRequisition(req);
  };

  const adjustPack = (itemId: string, delta: number) => {
    setPackData((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) + delta) }));
  };

  const adjustStoreLog = (productId: string, delta: number) => {
    setStoreLogData((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  };

  const adjustWastage = (productId: string, delta: number) => {
    setWastageData((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  };

  const handleProcessOrder = async () => {
    if (!activeRequisition) return;
    setIsSubmitting(true);

    try {
      // Update store_requisitions status to 'fulfilled'
      await supabase
        .from("store_requisitions")
        .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
        .eq("id", activeRequisition.id);

      // Update fulfilled_qty on each item
      for (const item of activeRequisition.items) {
        const produced = packData[item.id] || 0;
        await supabase
          .from("store_requisition_items")
          .update({ fulfilled_qty: produced })
          .eq("id", item.id);
      }

      toast.success(`${activeRequisition.batch_id}: Requisition Fulfilled!`, { icon: "✅" });
      setActiveRequisition(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to update requisition.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePanicRequest = async () => {
    if (!panicProductId || !panicQty || parseInt(panicQty) <= 0) {
      toast.warning("Select a product and enter a valid quantity.");
      return;
    }
    setPanicSubmitting(true);
    try {
      // Create a panic requisition to ready_goods store
      const { data: reqData, error: reqError } = await supabase
        .from("store_requisitions")
        .insert({
          order_id: "00000000-0000-0000-0000-000000000000",
          target_store: "ready_goods",
          is_panic_order: true,
          notes: "PANIC: Item damaged during packing",
          status: "pending",
        })
        .select("id")
        .single();

      if (reqError) throw reqError;

      await supabase.from("store_requisition_items").insert({
        requisition_id: reqData.id,
        product_id: panicProductId,
        requested_qty: parseInt(panicQty),
      });

      // Audit log
      await supabase.from("audit_logs").insert({
        module_name: "operations",
        action_type: "panic_stock_request",
        entity_name: "store_requisitions",
        entity_id: reqData.id,
        actor_id: user?.id || null,
        new_value: { product_id: panicProductId, qty: parseInt(panicQty), department: myDepartment },
      });

      toast.success("🚨 Panic request sent to Ready Goods store!", { icon: "🚨" });
      setShowPanicModal(false);
      setPanicProductId("");
      setPanicQty("");
      fetchData();
    } catch (err) {
      toast.error("Failed to submit panic request.");
    } finally {
      setPanicSubmitting(false);
    }
  };

  const handleLogToStore = async () => {
    setIsSubmitting(true);

    try {
      const rows = Object.entries(storeLogData)
        .filter(([, qty]) => qty > 0)
        .map(([productId, qty]) => ({
          product_id: productId,
          department: myDepartment,
          produced_qty: qty,
          wastage_qty: wastageData[productId] || 0,
          logged_by: user?.id || null,
        }));

      if (rows.length === 0) {
        toast.warning("No quantities to log.");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from("daily_production_logs").insert(rows);

      if (error) {
        toast.error("Failed to log production: " + error.message);
      } else {
        const totalLogged = rows.reduce((sum, r) => sum + r.produced_qty, 0);
        toast.success(`${totalLogged} units logged to ${deptLabel} production.`, { icon: "🏭" });

        const resetData: Record<string, number> = {};
        const resetWastage: Record<string, number> = {};
        departmentProducts.forEach((p) => {
          resetData[p.id] = 0;
          resetWastage[p.id] = 0;
        });
        setStoreLogData(resetData);
        setWastageData(resetWastage);
      }
    } catch {
      toast.error("Unexpected error logging production.");
    } finally {
      setIsSubmitting(false);
    }
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
                <option key={d.value} value={d.value} className="text-black">
                  {d.label}
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
          {myDepartment === "packing_assembly" && (
            <button
              onClick={() => setShowPanicModal(true)}
              className="w-full py-4 rounded-2xl bg-red-600 text-white font-black text-sm uppercase tracking-widest active:scale-95 shadow-lg shadow-red-600/30 flex justify-center items-center gap-2 mb-2"
            >
              🚨 Panic: Request Fresh Stock
            </button>
          )}
          {requisitions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 shadow-sm mt-4">
              <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3 opacity-50" />
              <p className="text-slate-400 font-bold uppercase tracking-widest">No Batches for {deptLabel}</p>
            </div>
          ) : (
            requisitions.map((req) => {
              const isDelayed = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 3600000) > 24;

              return (
                <div
                  key={req.id}
                  onClick={() => openPackingScreen(req)}
                  className={`rounded-2xl border-l-8 p-5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer bg-white ${isDelayed ? "border-red-500" : "border-slate-800"}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                        <Hash size={10} /> Priority Batch
                      </p>
                      <h3 className="font-black text-2xl leading-tight text-slate-900">{req.batch_id}</h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">
                        SO-{req.order_id.split("-")[0].toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm font-bold text-[#B8860B] flex items-center gap-1.5">
                      <Package size={16} /> {req.items.length} Tasks Required
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
            {departmentProducts.length === 0 ? (
              <p className="text-center text-sm font-bold text-slate-400 mt-10">
                No products categorized under {deptLabel} yet.
              </p>
            ) : (
              departmentProducts.map((product) => {
                const qty = storeLogData[product.id] || 0;
                const waste = wastageData[product.id] || 0;

                return (
                  <div
                    key={product.id}
                    className={`bg-white rounded-xl p-3 border shadow-sm ${qty > 0 ? "border-emerald-400" : "border-slate-200"}`}
                  >
                    <div className="flex items-center justify-between">
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

                    {/* Wastage Counter */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                        🗑️ Wastage
                      </span>
                      <div className="flex items-center bg-red-50 rounded-lg border border-red-200 h-7">
                        <button
                          onClick={() => adjustWastage(product.id, -1)}
                          className="w-8 h-full flex items-center justify-center text-red-400 font-black active:bg-red-100 rounded-l-lg text-xs"
                        >
                          -
                        </button>
                        <span className={`font-black text-xs w-8 text-center ${waste > 0 ? "text-red-600" : "text-slate-400"}`}>{waste}</span>
                        <button
                          onClick={() => adjustWastage(product.id, 1)}
                          className="w-8 h-full flex items-center justify-center text-red-500 font-black active:bg-red-100 rounded-r-lg text-xs"
                        >
                          +
                        </button>
                      </div>
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
        {activeRequisition && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-[100dvh]"
          >
            <div className="p-5 flex justify-between items-center text-white bg-slate-900">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{deptLabel} Dept • Task</p>
                <h2 className="text-3xl font-black">{activeRequisition.batch_id}</h2>
              </div>
              <button
                onClick={() => setActiveRequisition(null)}
                className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center active:bg-white/20"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeRequisition.items.map((item) => {
                const produced = packData[item.id] || 0;
                const target = item.requested_qty;
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

              activeRequisition.items.forEach((item) => {
                const p = packData[item.id] || 0;
                totalProduced += p;
                if (p < item.requested_qty) isPartial = true;
                if (p > item.requested_qty) hasExcess = true;
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

      {/* PANIC MODAL */}
      <AnimatePresence>
        {showPanicModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-xl text-slate-900">🚨 Panic Stock Request</h3>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">
                    Emergency replacement from Ready Goods
                  </p>
                </div>
                <button
                  onClick={() => setShowPanicModal(false)}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Product</label>
                  <select
                    value={panicProductId}
                    onChange={(e) => setPanicProductId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-red-500"
                  >
                    <option value="">Select product...</option>
                    {allProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Quantity Needed</label>
                  <input
                    type="number"
                    min="1"
                    value={panicQty}
                    onChange={(e) => setPanicQty(e.target.value)}
                    placeholder="Enter quantity"
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-lg font-black outline-none focus:border-red-500"
                  />
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                    ⚠️ This will create an urgent requisition to the Ready Goods store marked as PANIC ORDER.
                  </p>
                </div>
                <button
                  onClick={handlePanicRequest}
                  disabled={panicSubmitting}
                  className="w-full py-4 rounded-xl bg-red-600 text-white font-black text-sm uppercase tracking-widest active:scale-95 shadow-lg shadow-red-600/20 flex justify-center items-center gap-2"
                >
                  {panicSubmitting ? <Loader2 className="animate-spin" size={18} /> : "🚨 Submit Panic Request"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OperationsController;
