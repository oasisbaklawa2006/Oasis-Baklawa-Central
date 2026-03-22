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
  Info,
  MapPin,
  Scale,
  ChevronRight,
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
      if (orders?.length) setActiveOrder(orders.find((o) => o.status !== "delivered"));
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
        {/* HEADER SECTION */}
        <header className="flex justify-between items-start pt-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {company?.business_name || "Partner Portal"}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
              Wholesale Command Center
            </p>
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <Settings size={20} className="text-slate-600" />
          </button>
        </header>

        {/* ── AI ORDER FETCHER (SMART TOOL) ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-6 text-white relative overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Sparkles size={100} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="px-2 py-1 bg-[#B8860B] rounded text-[9px] font-black uppercase tracking-widest text-white">
                AI Suggestion
              </div>
            </div>
            <h2 className="text-xl font-bold leading-tight mb-2">Replenish your inventory?</h2>
            <p className="text-slate-400 text-xs mb-5 max-w-[200px]">
              Based on your last 3 orders, you're likely running low on{" "}
              <span className="text-white font-bold">Pyramid Baklawa</span>.
            </p>
            <button
              onClick={() => navigate("/catalogue")}
              className="bg-white text-slate-900 px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl hover:scale-105 transition-transform active:scale-95"
            >
              Quick Load Next Batch <ArrowUpRight size={14} />
            </button>
          </div>
        </motion.section>

        {/* ── TRACKER ── */}
        {activeOrder && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <span>Live Tracking: ORD-{activeOrder.id.split("-")[0]}</span>
              <span className="text-[#B8860B]">In Kitchen</span>
            </div>
            <div className="flex justify-between gap-1 h-1.5 mb-2">
              <div className="flex-1 bg-[#B8860B] rounded-full" />
              <div className="flex-1 bg-[#B8860B] rounded-full" />
              <div className="flex-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: "60%" }} className="h-full bg-[#B8860B]" />
              </div>
              <div className="flex-1 bg-slate-100 rounded-full" />
            </div>
            <p className="text-[11px] text-slate-600 font-medium">Chef is currently preparing your artisanal batch.</p>
          </div>
        )}

        {/* ── BUSINESS DATA TOOLS ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Sales Volume</p>
              <p className="text-lg font-black text-slate-900">{formatPrice(activeOrder?.sales_order_value || 0)}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <Scale size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Weight</p>
              <p className="text-lg font-black text-slate-900">42.5 KG</p>
            </div>
          </div>
        </div>

        {/* ── SETTINGS & UTILITIES (FORMERLY FOOTER) ── */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">
            Settings & Transparency
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900">Business Profile</p>
                  <p className="text-[10px] text-slate-400">GST: {company?.gst_number || "Add GSTIN"}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>

            <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Registered Address</p>
                  <p className="text-[10px] text-slate-400 truncate w-40">Oasis Baklawa HQ, New Delhi</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>

            <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500">
                  <Download size={18} />
                </div>
                <p className="text-sm font-bold text-slate-900">Download Price List</p>
              </div>
              <ArrowUpRight size={18} className="text-slate-300" />
            </button>

            <div className="p-6 bg-slate-50/50">
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
                <button className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900">
                  Privacy Policy
                </button>
                <button className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900">
                  Terms of Trade
                </button>
                <button className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900">
                  Refund Policy
                </button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-medium">© 2026 Oasis Baklawa B2B Portal</p>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-md bg-slate-200" />
                  <div className="w-6 h-6 rounded-md bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CONCIERGE (THE VITAL PAGE FEEL) ── */}
        <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 opacity-10 -mt-10 -mr-10">
            <Headphones size={200} />
          </div>
          <h2 className="text-2xl font-bold mb-2">VIP Concierge</h2>
          <p className="text-slate-400 text-xs mb-6">Need a custom wholesale blend? Contact your manager.</p>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="https://wa.me/919891162212"
              className="bg-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/20 transition-colors border border-white/5 shadow-xl backdrop-blur-md"
            >
              <MessageCircle className="text-[#25D366]" size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
            </a>
            <a
              href="tel:+919999792959"
              className="bg-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/20 transition-colors border border-white/5 shadow-xl backdrop-blur-md"
            >
              <Phone className="text-[#B8860B]" size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Call Desk</span>
            </a>
          </div>
        </section>
      </div>
      <BottomNavBar />
    </AppShell>
  );
};

const formatPrice = (val: number) => "₹" + Math.round(val).toLocaleString("en-IN");

export default Dashboard;
