import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Image as ImageIcon,
  Minus,
  Plus,
  ArrowRightLeft,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Types
type Urgency = "critical" | "warning" | "safe";
type QueueType = "customer" | "interdepartmental" | "regular";

interface OrderItem {
  id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_packed: number;
  image_url?: string;
  assembly_instructions?: string;
}

interface OperationOrder {
  id: string;
  type: QueueType;
  company_name: string;
  urgency: Urgency;
  deadline: string;
  items: OrderItem[];
}

const OperationsController = () => {
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState<QueueType>("customer");
  const [orders, setOrders] = useState<OperationOrder[]>([]);

  // Action Modal State
  const [activeOrder, setActiveOrder] = useState<OperationOrder | null>(null);
  const [packData, setPackData] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // MOCK DATA: Simulating the TV's backend logic for urgency and 3 queues
  useEffect(() => {
    setTimeout(() => {
      setOrders([
        {
          id: "ORD-991A",
          type: "customer",
          company_name: "Emirates Sweets",
          urgency: "critical",
          deadline: "45 Mins",
          items: [
            {
              id: "i1",
              product_name: "Royal Wedding Box Assortment",
              quantity_ordered: 20,
              quantity_packed: 0,
              image_url:
                "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=200",
              assembly_instructions:
                "Arrange 4 Pyramid, 2 Finger, 2 Tart per box. Gold ribbon seal.",
            },
            {
              id: "i2",
              product_name: "Pistachio Tart (Loose)",
              quantity_ordered: 5,
              quantity_packed: 0,
            },
          ],
        },
        {
          id: "ORD-992B",
          type: "customer",
          company_name: "TCF Chocolates",
          urgency: "warning",
          deadline: "2.5 Hours",
          items: [
            {
              id: "i3",
              product_name: "Pyramid Baklawa (6 Pcs)",
              quantity_ordered: 50,
              quantity_packed: 0,
            },
          ],
        },
        {
          id: "INT-001",
          type: "interdepartmental",
          company_name: "Kitchen -> Assembly",
          urgency: "critical",
          deadline: "ASAP",
          items: [
            {
              id: "i4",
              product_name: "Fresh Baked Tart Shells",
              quantity_ordered: 200,
              quantity_packed: 0,
            },
          ],
        },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const openPackingScreen = (order: OperationOrder) => {
    const initialPack: Record<string, number> = {};
    order.items.forEach((item) => {
      initialPack[item.id] = 0;
    });
    setPackData(initialPack);
    setActiveOrder(order);
  };

  const adjustPack = (itemId: string, delta: number, max: number) => {
    setPackData((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const handleCompleteTask = async () => {
    if (!activeOrder) return;
    setIsSubmitting(true);

    let isPartial = false;
    activeOrder.items.forEach((item) => {
      if (packData[item.id] < item.quantity_ordered) isPartial = true;
    });

    setTimeout(() => {
      if (isPartial) {
        toast.warning(
          `Partial Fulfillment Logged. Backorder raised for remaining items.`,
          { icon: "⚠️" }
        );
      } else {
        toast.success(
          `Order ${activeOrder.id} Packed & Ready for Finance!`,
          { icon: "✅" }
        );
      }

      setOrders(orders.filter((o) => o.id !== activeOrder.id));
      setActiveOrder(null);
      setIsSubmitting(false);
    }, 1000);
  };

  const filteredOrders = orders
    .filter((o) => o.type === activeQueue)
    .sort((a, b) => {
      const urgencyWeight: Record<Urgency, number> = { critical: 1, warning: 2, safe: 3 };
      return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    });

  const getUrgencyColors = (urgency: Urgency) => {
    if (urgency === "critical")
      return "bg-red-50 border-red-500 text-red-900";
    if (urgency === "warning")
      return "bg-amber-50 border-amber-400 text-amber-900";
    return "bg-emerald-50 border-emerald-400 text-emerald-900";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      {/* HEADER - INDUSTRIAL BLACK */}
      <div className="bg-slate-950 text-white px-4 pt-6 pb-4 rounded-b-3xl shadow-xl">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-black tracking-wide">Floor Control</h1>
          <p className="text-sm text-slate-400 font-medium mt-0.5">
            Assembly & Dispatch Room
          </p>

          {/* 3-PANE QUEUE SELECTOR */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveQueue("customer")}
              className={`flex-1 py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                activeQueue === "customer"
                  ? "bg-[#B8860B] text-white shadow-inner"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <Package size={18} />
              Customer
            </button>
            <button
              onClick={() => setActiveQueue("interdepartmental")}
              className={`flex-1 py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                activeQueue === "interdepartmental"
                  ? "bg-blue-600 text-white shadow-inner"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <ArrowRightLeft size={18} />
              Internal
            </button>
            <button
              onClick={() => setActiveQueue("regular")}
              className={`flex-1 py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                activeQueue === "regular"
                  ? "bg-slate-100 text-slate-900 shadow-inner"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <Layers size={18} />
              Regular
            </button>
          </div>
        </div>
      </div>

      {/* ORDER LIST */}
      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle2 size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-bold text-slate-400">Queue is Empty</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={() => openPackingScreen(order)}
              className={`rounded-2xl border-l-8 p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer ${getUrgencyColors(
                order.urgency
              )}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-bold">{order.id}</p>
                  <p className="text-base font-semibold mt-0.5">
                    {order.company_name}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold opacity-80">
                  <Clock size={14} /> {order.deadline}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs opacity-70">
                <span className="font-semibold">
                  {order.items.length} Items to Pack
                </span>
                <ChevronRight size={16} />
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* THE ACTION MODAL (Fullscreen Tablet View) */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-xl font-black">
                  {activeOrder.id}
                </p>
                <p className="text-sm text-slate-400 font-medium">
                  {activeOrder.company_name}
                </p>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center active:bg-black/40"
              >
                <X size={24} />
              </button>
            </div>

            {/* Checklist Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {activeOrder.items.map((item) => {
                const isFullyPacked =
                  packData[item.id] === item.quantity_ordered;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border-2 p-4 transition-colors ${
                      isFullyPacked
                        ? "bg-emerald-50 border-emerald-400"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Image / Icon */}
                      <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon size={28} className="text-slate-300" />
                        )}
                      </div>

                      {/* Details & Controls */}
                      <div className="flex-1">
                        <div className="mb-3">
                          <h3 className="font-bold text-slate-900">
                            {item.product_name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Target: {item.quantity_ordered} Units
                          </p>
                          {item.assembly_instructions && (
                            <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-2 py-1 mt-2">
                              ℹ️ {item.assembly_instructions}
                            </p>
                          )}
                        </div>

                        {/* Massive Touch Stepper */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              adjustPack(item.id, -1, item.quantity_ordered)
                            }
                            className="w-12 h-12 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-slate-700 active:bg-slate-100"
                          >
                            <Minus size={20} />
                          </button>
                          <div className="text-2xl font-black text-slate-900 w-12 text-center">
                            {packData[item.id]}
                          </div>
                          <button
                            onClick={() =>
                              adjustPack(item.id, 1, item.quantity_ordered)
                            }
                            className={`w-12 h-12 rounded-lg shadow-sm flex items-center justify-center active:scale-95 ${
                              isFullyPacked
                                ? "bg-emerald-100 text-emerald-600 opacity-50"
                                : "bg-slate-900 text-white"
                            }`}
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

            {/* Sticky Action Footer */}
            {(() => {
              let totalPacked = 0;
              let isPartial = false;
              activeOrder.items.forEach((item) => {
                totalPacked += packData[item.id];
                if (packData[item.id] < item.quantity_ordered)
                  isPartial = true;
              });

              if (totalPacked === 0) {
                return (
                  <div className="p-5 bg-slate-100 text-center">
                    <p className="text-sm font-semibold text-slate-400">
                      Start Packing to Proceed
                    </p>
                  </div>
                );
              }

              if (isPartial) {
                return (
                  <div className="p-5 bg-amber-50 border-t-2 border-amber-400 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle size={18} />
                      <p className="text-sm font-bold">Mismatch Detected</p>
                    </div>
                    <button
                      onClick={handleCompleteTask}
                      disabled={isSubmitting}
                      className="w-full py-4 bg-amber-500 text-white rounded-xl font-black text-lg active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2
                          size={24}
                          className="animate-spin mx-auto"
                        />
                      ) : (
                        "Log Partial & Raise Backorder"
                      )}
                    </button>
                  </div>
                );
              }

              return (
                <div className="p-5 bg-emerald-50 border-t-2 border-emerald-400 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={18} />
                    <p className="text-sm font-bold">
                      All Items Match Target
                    </p>
                  </div>
                  <button
                    onClick={handleCompleteTask}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2
                        size={24}
                        className="animate-spin mx-auto"
                      />
                    ) : (
                      "Mark Fully Completed"
                    )}
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
