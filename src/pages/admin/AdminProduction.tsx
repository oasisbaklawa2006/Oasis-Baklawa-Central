import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Flame, AlertTriangle, Clock, Factory, Wrench, Package } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import TopNavBar from "@/components/TopNavBar";

interface ProdOrder {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  created_at: string | null;
  company?: { business_name: string } | null;
  order_items?: { id: string; quantity: number; product_id: string | null; product?: { name: string } | null }[];
}

type Urgency = "critical" | "warning" | "safe";

const AdminProduction = () => {
  const [orders, setOrders] = useState<ProdOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { t } = useLanguage();

  // Live Clock Updater for TV
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = async () => {
    // Fetching active factory orders
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, sales_order_value, company_id, created_at, company:companies(business_name), order_items(id, quantity, product:products(name))",
      )
      .in("status", ["verified_advance", "in_production", "assembly"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setOrders((data as unknown as ProdOrder[]) ?? []);
    }
    setLoading(false);
  };

  // Auto-refresh the TV every 15 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  // Calculate Urgency based on actual DB creation time
  const getUrgency = (createdAt: string | null): Urgency => {
    if (!createdAt) return "safe";
    const hoursSince = (Date.now() - new Date(createdAt).getTime()) / 3600000;
    if (hoursSince > 48) return "critical"; // > 48 hours = Red
    if (hoursSince > 24) return "warning"; // > 24 hours = Yellow
    return "safe"; // Green
  };

  const getUrgencyColors = (urgency: Urgency) => {
    if (urgency === "critical") return "bg-red-950/40 border-red-500 text-red-100";
    if (urgency === "warning") return "bg-amber-950/40 border-amber-500 text-amber-100";
    return "bg-emerald-950/20 border-emerald-500/50 text-emerald-100";
  };

  const getUrgencyIcon = (urgency: Urgency) => {
    if (urgency === "critical") return <Flame className="text-red-500 animate-pulse" size={24} />;
    if (urgency === "warning") return <AlertTriangle className="text-amber-500" size={24} />;
    return <Clock className="text-emerald-500" size={24} />;
  };

  // Splitting real data into the 3 TV Panes
  const productionOrders = orders.filter((o) => o.status === "in_production");
  const assemblyOrders = orders.filter((o) => o.status === "assembly");
  const upcomingOrders = orders.filter((o) => o.status === "verified_advance");

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="w-16 h-16 text-slate-500 animate-spin" />
      </div>
    );

  return (
    <div className="bg-black min-h-screen text-white overflow-hidden flex flex-col font-sans">
      <TopNavBar />

      {/* TV HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shrink-0 mt-14">
        <div className="flex items-center gap-4">
          <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
          <h1 className="text-3xl font-black tracking-widest uppercase text-slate-100">{t("Live Production Floor")}</h1>
        </div>
        <div className="text-right flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm font-bold text-red-400">
              <Flame size={14} /> &gt; 48 Hrs
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-amber-400">
              <AlertTriangle size={14} /> &gt; 24 Hrs
            </span>
          </div>
          <p className="text-4xl font-black font-mono text-[#B8860B] tracking-tight bg-black/50 px-4 py-1 rounded-xl">
            {currentTime.toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* 3-COLUMN TV GRID */}
      <div className="flex-1 grid grid-cols-3 gap-6 p-6 h-full overflow-hidden pb-10">
        {/* COLUMN 1: LIVE PRODUCTION (Baking/Making) */}
        <div className="flex flex-col bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="bg-slate-800 p-4 flex items-center justify-between shadow-lg">
            <h2 className="text-2xl font-black uppercase tracking-wider flex items-center gap-3">
              <Factory size={28} className="text-[#B8860B]" /> {t("In Production")}
            </h2>
            <span className="bg-slate-700 text-white px-3 py-1 rounded-lg text-xl font-bold">
              {productionOrders.length}
            </span>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full">
            {productionOrders.length === 0 && (
              <p className="text-center text-slate-600 font-bold mt-10 text-xl uppercase tracking-widest">
                No Active Orders
              </p>
            )}
            {productionOrders.map((order) => {
              const urgency = getUrgency(order.created_at);
              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-l-[12px] p-5 shadow-lg ${getUrgencyColors(urgency)}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm font-black opacity-60 tracking-widest mb-1">{order.id.slice(0, 8)}</p>
                      <h3 className="text-3xl font-black leading-tight">
                        {order.company?.business_name ?? "Walk-In / Direct"}
                      </h3>
                    </div>
                    {getUrgencyIcon(urgency)}
                  </div>
                  <div className="space-y-2 bg-black/40 rounded-xl p-4">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center border-b border-white/5 last:border-0 pb-2 last:pb-0"
                      >
                        <p className="text-xl font-bold text-slate-200">{item.product?.name ?? "Unknown Item"}</p>
                        <span className="text-3xl font-black text-white ml-4">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: ASSEMBLY LINE */}
        <div className="flex flex-col bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="bg-blue-950/40 border-b border-blue-900/50 p-4 flex items-center justify-between shadow-lg">
            <h2 className="text-2xl font-black uppercase tracking-wider flex items-center gap-3 text-blue-100">
              <Wrench size={28} className="text-blue-500" /> {t("Assembly")}
            </h2>
            <span className="bg-blue-900/50 text-blue-200 px-3 py-1 rounded-lg text-xl font-bold">
              {assemblyOrders.length}
            </span>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full">
            {assemblyOrders.length === 0 && (
              <p className="text-center text-blue-900 font-bold mt-10 text-xl uppercase tracking-widest">Queue Clear</p>
            )}
            {assemblyOrders.map((order) => {
              const urgency = getUrgency(order.created_at);
              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-l-[12px] p-5 shadow-lg ${getUrgencyColors(urgency)}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm font-black opacity-60 tracking-widest mb-1">{order.id.slice(0, 8)}</p>
                      <h3 className="text-3xl font-black leading-tight text-blue-50">
                        {order.company?.business_name ?? "Walk-In / Direct"}
                      </h3>
                    </div>
                    {getUrgencyIcon(urgency)}
                  </div>
                  <div className="space-y-2 bg-black/40 rounded-xl p-4">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center border-b border-white/5 last:border-0 pb-2 last:pb-0"
                      >
                        <p className="text-xl font-bold text-blue-100">{item.product?.name ?? "Unknown Item"}</p>
                        <span className="text-3xl font-black text-blue-300 ml-4">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 3: UPCOMING / PENDING */}
        <div className="flex flex-col bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="bg-slate-800 p-4 flex items-center justify-between shadow-lg">
            <h2 className="text-2xl font-black uppercase tracking-wider flex items-center gap-3 text-slate-300">
              <Package size={28} className="text-slate-500" /> {t("Upcoming")}
            </h2>
            <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-xl font-bold">
              {upcomingOrders.length}
            </span>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full">
            {upcomingOrders.length === 0 && (
              <p className="text-center text-slate-700 font-bold mt-10 text-xl uppercase tracking-widest">
                No Pending Orders
              </p>
            )}
            {upcomingOrders.map((order) => (
              <div key={order.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 opacity-80">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs font-black text-slate-500 tracking-widest mb-1">{order.id.slice(0, 8)}</p>
                    <h3 className="text-xl font-black text-slate-300 leading-tight">
                      {order.company?.business_name ?? "Walk-In / Direct"}
                    </h3>
                  </div>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  {order.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-1.5 last:pb-0"
                    >
                      <p className="font-bold text-slate-400">{item.product?.name ?? "Unknown Item"}</p>
                      <span className="font-black text-slate-300 ml-2">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global CSS for the invisible scrollbar styling specific to this TV screen */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 0px; background: transparent; }
        .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default AdminProduction;
