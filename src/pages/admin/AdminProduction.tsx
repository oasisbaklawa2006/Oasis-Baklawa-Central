import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Flame, AlertTriangle, Clock, Factory, Wrench, Package } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import TopNavBar from "@/components/TopNavBar";

interface ProdOrder {
  id: string;
  status: string;
  created_at: string | null;
  order_items?: { id: string; quantity: number; product?: { name: string } | null }[];
}

type Urgency = "critical" | "warning" | "safe";

const AdminProduction = () => {
  const [orders, setOrders] = useState<ProdOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, created_at, order_items(id, quantity, product:products(name))")
      .in("status", ["verified_advance", "in_production", "assembly"])
      .order("created_at", { ascending: true });

    if (!error) setOrders((data as unknown as ProdOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const getUrgency = (createdAt: string | null): Urgency => {
    if (!createdAt) return "safe";
    const hoursSince = (Date.now() - new Date(createdAt).getTime()) / 3600000;
    if (hoursSince > 48) return "critical";
    if (hoursSince > 24) return "warning";
    return "safe";
  };

  const getUrgencyColors = (urgency: Urgency) => {
    if (urgency === "critical") return "bg-red-950/40 border-red-500/50 text-red-100";
    if (urgency === "warning") return "bg-amber-950/40 border-amber-500/50 text-amber-100";
    return "bg-emerald-950/20 border-emerald-500/30 text-emerald-100";
  };

  const getUrgencyIcon = (urgency: Urgency) => {
    if (urgency === "critical") return <Flame className="text-red-500 animate-pulse" size={18} />;
    if (urgency === "warning") return <AlertTriangle className="text-amber-500" size={18} />;
    return <Clock className="text-emerald-500" size={18} />;
  };

  const productionOrders = orders.filter((o) => o.status === "in_production");
  const assemblyOrders = orders.filter((o) => o.status === "assembly");
  const upcomingOrders = orders.filter((o) => o.status === "verified_advance");

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="w-12 h-12 text-slate-500 animate-spin" />
      </div>
    );

  return (
    <div className="bg-black min-h-screen text-white overflow-hidden flex flex-col font-sans">
      <TopNavBar />

      {/* TV HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center shrink-0 mt-14">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
          <h1 className="text-xl font-black tracking-widest uppercase text-slate-100">{t("Production Display")}</h1>
        </div>
        <div className="text-right flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-bold text-red-400">
              <Flame size={12} /> &gt; 48 Hrs
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
              <AlertTriangle size={12} /> &gt; 24 Hrs
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-[#B8860B] tracking-tight bg-black/50 px-3 py-1 rounded-lg">
            {currentTime.toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* 3-COLUMN TV GRID */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 h-full overflow-hidden pb-6">
        {/* COLUMN 1: LIVE PRODUCTION */}
        <div className="flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="bg-slate-800 p-3 flex items-center justify-between shadow-sm">
            <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2 text-slate-100">
              <Factory size={18} className="text-[#B8860B]" /> {t("Production")}
            </h2>
            <span className="bg-slate-700 text-white px-2.5 py-0.5 rounded text-sm font-bold">
              {productionOrders.length}
            </span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar h-full">
            {productionOrders.map((order) => {
              const urgency = getUrgency(order.created_at);
              return (
                <div key={order.id} className={`rounded-xl border-l-[8px] p-3 shadow-md ${getUrgencyColors(urgency)}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-black tracking-widest leading-none">
                      ID: {order.id.split("-")[0].toUpperCase()}
                    </h3>
                    {getUrgencyIcon(urgency)}
                  </div>
                  <div className="space-y-1.5 bg-black/30 rounded-lg p-2.5">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center border-b border-white/5 last:border-0 pb-1.5 last:pb-0"
                      >
                        <p className="text-sm font-bold text-slate-200 truncate pr-2">
                          {item.product?.name ?? "Unknown Item"}
                        </p>
                        <span className="text-lg font-black text-white shrink-0">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: ASSEMBLY LINE */}
        <div className="flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="bg-blue-950/40 border-b border-blue-900/50 p-3 flex items-center justify-between shadow-sm">
            <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2 text-blue-100">
              <Wrench size={18} className="text-blue-500" /> {t("Assembly")}
            </h2>
            <span className="bg-blue-900/50 text-blue-200 px-2.5 py-0.5 rounded text-sm font-bold">
              {assemblyOrders.length}
            </span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar h-full">
            {assemblyOrders.map((order) => {
              const urgency = getUrgency(order.created_at);
              return (
                <div key={order.id} className={`rounded-xl border-l-[8px] p-3 shadow-md ${getUrgencyColors(urgency)}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-black tracking-widest leading-none text-blue-50">
                      ID: {order.id.split("-")[0].toUpperCase()}
                    </h3>
                    {getUrgencyIcon(urgency)}
                  </div>
                  <div className="space-y-1.5 bg-black/30 rounded-lg p-2.5">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center border-b border-white/5 last:border-0 pb-1.5 last:pb-0"
                      >
                        <p className="text-sm font-bold text-blue-100 truncate pr-2">
                          {item.product?.name ?? "Unknown Item"}
                        </p>
                        <span className="text-lg font-black text-blue-300 shrink-0">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 3: UPCOMING */}
        <div className="flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="bg-slate-800 p-3 flex items-center justify-between shadow-sm">
            <h2 className="text-lg font-black uppercase tracking-wider flex items-center gap-2 text-slate-300">
              <Package size={18} className="text-slate-500" /> {t("Upcoming")}
            </h2>
            <span className="bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded text-sm font-bold">
              {upcomingOrders.length}
            </span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar h-full">
            {upcomingOrders.map((order) => (
              <div key={order.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 opacity-90">
                <h3 className="text-base font-black tracking-widest text-slate-400 mb-2">
                  ID: {order.id.split("-")[0].toUpperCase()}
                </h3>
                <div className="bg-black/30 rounded-lg p-2">
                  {order.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center border-b border-white/5 last:border-0 pb-1 last:pb-0 mt-1 first:mt-0"
                    >
                      <p className="text-xs font-bold text-slate-400 truncate pr-2">
                        {item.product?.name ?? "Unknown Item"}
                      </p>
                      <span className="text-sm font-black text-slate-300 shrink-0">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 0px; background: transparent; }
        .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default AdminProduction;
