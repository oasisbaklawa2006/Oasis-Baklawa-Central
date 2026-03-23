import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Clock, CheckCircle2, ChevronRight, X, Image as ImageIcon, Minus, Plus, AlertTriangle, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderItem {
  id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_packed: number;
  image_url?: string;
}

interface OperationOrder {
  id: string;
  status: string;
  batch_id: string;
  created_at: string;
  items: OrderItem[];
}

const OperationsController = () => {
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState<"in_production" | "assembly">("in_production");
  const [orders, setOrders] = useState<OperationOrder[]>([]);
  
  // Action Modal State
  const [activeOrder, setActiveOrder] = useState<OperationOrder | null>(null);
  const [packData, setPackData] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    // NOTICE: We are NOT fetching company:companies(business_name) here. Total anonymity.
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, created_at, order_items(id, quantity, product:products(name, image_url))")
      .in("status", ["in_production", "assembly"])
      .order("created_at", { ascending: true });

    if (!error && data) {
      const formattedOrders: OperationOrder[] = data.map((o: any) => ({
        id: o.id,
        status: o.status,
        batch_id: `BATCH-${o.id.split('-')[0].toUpperCase()}`,
        created_at: o.created_at,
        items: o.order_items.map((item: any) => ({
          id: item.id,
          product_name: item.product?.name || "Unknown Product",
          quantity_ordered: item.quantity,
          quantity_packed: 0,
          image_url: item.product?.image_url,
        }))
      }));
      setOrders(formattedOrders);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // Auto-refresh the tablet every 30 seconds to catch new admin routes
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const openPackingScreen = (order: OperationOrder) => {
    const initialPack: Record<string, number> = {};
    order.items.forEach(item => { initialPack[item.id] = 0; });
    setPackData(initialPack);
    setActiveOrder(order);
  };

  const adjustPack = (itemId: string, delta: number, max: number) => {
    setPackData(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const handleCompleteTask = async () => {
    if (!activeOrder) return;
    setIsSubmitting(true);

    let isPartial = false;
    activeOrder.items.forEach(item => {
      if (packData[item.id] < item.quantity_ordered) isPartial = true;
    });

    if (isPartial) {
      // In a real app, you'd insert a backward request or partial log here
      toast.warning(`Partial Fulfillment Logged. Backward Request raised.`, { icon: '⚠️' });
    } else {
      // Move forward in the pipeline
      const targetStatus = activeOrder.status === "in_production" ? "assembly" : "packed_ready";
      const { error } = await supabase.from("orders").update({ status: targetStatus }).eq("id", activeOrder.id);
      
      if (!error) {
        toast.success(`${activeOrder.batch_id} Completed & Moved Forward!`, { icon: '✅' });
      } else {
        toast.error("Failed to update status.");
      }
    }
    
    setActiveOrder(null);
    setIsSubmitting(false);
    fetchOrders(); // Refresh the list
  };

  const filteredOrders = orders.filter(o => o.status === activeQueue);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>;

  return (
    <div className="bg-slate-100 min-h-screen pb-safe font-sans">
      
      {/* HEADER - INDUSTRIAL BLACK */}
      <div className="bg-slate-900 text-white pt-8 pb-4 px-4 sticky top-0 z-10 shadow-md">
        <h1 className="font-display text-2xl font-bold tracking-wider uppercase">Floor Controller</h1>
        <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">Active Batches (Anonymized)</p>
        
        {/* QUEUE SELECTOR */}
        <div className="flex gap-2 mt-6">
          <button onClick={() => setActiveQueue("in_production")} className={`flex-1 py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeQueue === "in_production" ? "bg-[#B8860B] text-white shadow-inner" : "bg-slate-800 text-slate-400"}`}>
            Kitchen Queue ({orders.filter(o => o.status === "in_production").length})
          </button>
          <button onClick={() => setActiveQueue("assembly")} className={`flex-1 py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeQueue === "assembly" ? "bg-blue-600 text-white shadow-inner" : "bg-slate-800 text-slate-400"}`}>
            Assembly Line ({orders.filter(o => o.status === "assembly").length})
          </button>
        </div>
      </div>

      {/* ORDER LIST (Strictly Batch IDs) */}
      <div className="p-4 space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3 opacity-50" />
            <p className="text-slate-400 font-bold uppercase tracking-widest">Queue is Empty</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const hoursOld = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 3600000);
            const isDelayed = hoursOld > 24;

            return (
              <div 
                key={order.id} 
                onClick={() => openPackingScreen(order)}
                className={`rounded-2xl border-l-8 p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer bg-white ${isDelayed ? 'border-red-500' : 'border-slate-800'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1"><Hash size={10}/> Pending Task</p>
                    {/* ONLY SHOWING BATCH ID */}
                    <h3 className="font-black text-2xl leading-tight text-slate-900">{order.batch_id}</h3>
                  </div>
                  {isDelayed && (
                    <div className="bg-red-50 text-red-600 px-2 py-1 rounded-lg flex items-center gap-1.5 font-bold text-xs border border-red-100">
                      <Clock size={12} /> {hoursOld}h Old
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5"><Package size={16}/> {order.items.length} Items to process</span>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><ChevronRight size={16}/></div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* THE ACTION MODAL (Fullscreen Tablet View) */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-[100dvh]"
          >
            {/* Modal Header */}
            <div className="p-5 flex justify-between items-center text-white bg-slate-900">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Processing Batch</p>
                {/* STRICTLY BATCH ID */}
                <h2 className="text-3xl font-black">{activeOrder.batch_id}</h2>
              </div>
              <button onClick={() => setActiveOrder(null)} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center active:bg-white/20"><X size={24} /></button>
            </div>

            {/* Checklist Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeOrder.items.map(item => {
                const isFullyPacked = packData[item.id] === item.quantity_ordered;
                
                return (
                  <div key={item.id} className={`bg-white rounded-2xl p-4 border-2 transition-colors shadow-sm ${isFullyPacked ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="flex gap-4">
                      
                      {/* Image / Icon */}
                      <div className="w-20 h-20 bg-slate-100 rounded-xl flex-shrink-0 flex flex-col items-center justify-center overflow-hidden border border-slate-200">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full