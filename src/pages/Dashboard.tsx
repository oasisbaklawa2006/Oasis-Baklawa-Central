import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Wallet,
  CreditCard,
  Headphones,
  ArrowUpRight,
  Phone,
  MessageCircle,
  Mail,
  ShieldCheck,
  FileText,
  Loader2,
  Package,
  Lock,
  Clock,
  ChefHat,
  Truck,
  Download,
  Sparkles,
  Settings,
  ChevronRight,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BottomNavBar from "@/components/BottomNavBar";

const Dashboard = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: userData } = await supabase
        .from("users")
        .select("*, company:companies(*)")
        .eq("id", session.user.id)
        .single();
      if (userData?.company) setCompany(userData.company);
      const { data: orders } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (orders?.length) setActiveOrder(orders.find((o) => o.status !== "delivered" && o.status !== "cancelled"));
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-[#B8860B]" />
      </div>
    );

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50 px-5 pt-8 pb-32 max-w-3xl mx-auto space-y-6">
        {/* HEADER */}
        <header className="flex justify-between items-center pt-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">{company?.business_name || "Portal"}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-500" /> Verified Wholesale Account
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#B8860B]/10 flex items-center justify-center border border-[#B8860B]/20">
            <TrendingUp size={18} className="text-[#B8860B]" />
          </div>
        </header>

        {/* AI ORDER FETCH TOOL */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Sparkles size={80} />
          </div>
          <div className="relative z-10">
            <h2 className="text-lg font-bold mb-1">AI Smart-Restock</h2>
            <p className="text-slate-400 text-[11px] mb-4">
              Predicted low stock on <span className="text-[#B8860B] font-bold text-xs uppercase">Finger Baklawa</span>{" "}
              based on your velocity.
            </p>
            <button
              onClick={() => navigate("/catalogue")}
              className="bg-[#B8860B] text-white px-4 py-2.5 rounded-xl text-[11px] font-bold flex items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-[#B8860B]/20"
            >
              Add Suggested Items <ChevronRight size={14} />
            </button>
          </div>
        </motion.section>

        {/* LIVE TRACKER */}
        {activeOrder && (
          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase text-slate-400">
                Order Tracking: #{activeOrder.id.slice(0, 6)}
              </span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded">Processing</span>
            </div>
            <div className="flex gap-1.5 h-1.5 mb-3">
              <div className="flex-1 bg-[#B8860B] rounded-full" />
              <div className="flex-1 bg-[#B8860B] rounded-full" />
              <div className="flex-1 bg-slate-100 rounded-full" />
              <div className="flex-1 bg-slate-100 rounded-full" />
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Your batch is being handcrafted by our master chefs.
            </p>
          </div>
        )}

        {/* KEY PERFORMANCE METRICS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Spend LTV</p>
              <p className="text-sm font-black text-slate-900">
                ₹{activeOrder?.sales_order_value?.toLocaleString() || "0"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/orders")}
            className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 hover:bg-slate-50 transition-colors"
          >
            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
              <Package size={20} />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold text-slate-400 uppercase">History</p>
              <p className="text-sm font-black text-slate-900">View All</p>
            </div>
          </button>
        </div>

        {/* CONCIERGE HELP */}
        <section className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <MessageCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">Support Desk</p>
              <p className="text-[11px] text-slate-400 mt-1">Available 10 AM - 8 PM</p>
            </div>
          </div>
          <a
            href="https://wa.me/919891162212"
            className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-[11px] font-bold shadow-md active:scale-95"
          >
            Chat Now
          </a>
        </section>

        {/* COMPACT FOOTER SETTINGS (Moved to bottom) */}
        <section className="pt-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <Settings size={18} className="text-slate-400" />
                <span className="text-[13px] font-bold text-slate-700">Account Settings</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
            <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <Globe size={18} className="text-slate-400" />
                <span className="text-[13px] font-bold text-slate-700">Company Credentials</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
            <div className="p-5 bg-slate-50/50">
              <div className="flex gap-4 mb-4">
                <button className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900">
                  Privacy
                </button>
                <button className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900">
                  Terms
                </button>
                <button className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900">
                  Tax Info
                </button>
              </div>
              <div className="flex items-center justify-between opacity-50">
                <p className="text-[9px] font-bold text-slate-400">© 2026 OASIS BAKLAWA • B2B V2.1</p>
                <div className="flex gap-1">
                  <div className="w-4 h-4 bg-slate-200 rounded-sm" />
                  <div className="w-4 h-4 bg-slate-200 rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <BottomNavBar />
    </AppShell>
  );
};

export default Dashboard;
