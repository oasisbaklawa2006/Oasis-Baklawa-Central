import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Wallet,
  CreditCard,
  Share2,
  Headphones,
  FileText,
  ArrowUpRight,
  Building2,
  Phone,
  MessageCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// Static placeholder data for the locked Analytics chart
const monthlyData = [
  { month: "Oct", value: 45 },
  { month: "Nov", value: 62 },
  { month: "Dec", value: 85 },
  { month: "Jan", value: 55 },
  { month: "Feb", value: 72 },
  { month: "Mar", value: 90 },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [lifetimeValue, setLifetimeValue] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch real Company Profile
      const { data: userData } = await supabase
        .from("users")
        .select("*, company:companies(*)")
        .eq("id", session.user.id)
        .single();

      if (userData?.company) setCompany(userData.company);

      // 2. Fetch real Orders for LTV and Recent Activity
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, sales_order_value, created_at")
        .order("created_at", { ascending: false });

      if (orders) {
        const total = orders.reduce((sum, ord) => sum + (Number(ord.sales_order_value) || 0), 0);
        setLifetimeValue(total);
        setRecentOrders(orders.slice(0, 3)); // Get top 3 most recent
      }
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <AppShell>
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pb-24">
        {/* ── Dynamic Header ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-xl md:text-2xl tracking-wide text-foreground leading-tight">
            Welcome back,
            <br />
            <span className="text-primary">{company?.business_name || "Partner"}</span>
          </h1>
          <div className="flex items-center gap-4 mt-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-[11px] font-bold uppercase tracking-wider border border-green-200">
              <ShieldCheck size={12} /> Verified
            </span>
            <span className="text-xs font-medium text-muted-foreground">GST: {company?.gst_number || "Pending"}</span>
          </div>
        </motion.div>

        {/* ── Hero Metrics (Live + Grayscaled) ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Live Data Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-card rounded-2xl shadow-card p-4 space-y-2 border border-primary/20"
          >
            <TrendingUp size={18} className="text-primary" />
            <p className="font-body text-[11px] text-muted-foreground leading-tight">Lifetime Value</p>
            <p className="font-body font-bold text-foreground text-sm">{formatCurrency(lifetimeValue)}</p>
          </motion.div>

          {/* Locked Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="bg-card rounded-2xl shadow-card p-4 space-y-2 opacity-60 grayscale-[50%] pointer-events-none relative overflow-hidden"
          >
            <Wallet size={18} className="text-muted-foreground" />
            <p className="font-body text-[11px] text-muted-foreground leading-tight">Wallet Balance</p>
            <p className="font-body font-bold text-foreground text-sm">₹0</p>
            <div className="absolute top-2 right-2 text-[8px] uppercase tracking-wider font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              Soon
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="bg-card rounded-2xl shadow-card p-4 space-y-2 opacity-60 grayscale-[50%] pointer-events-none relative overflow-hidden"
          >
            <CreditCard size={18} className="text-muted-foreground" />
            <p className="font-body text-[11px] text-muted-foreground leading-tight">Credit Usage</p>
            <p className="font-body font-bold text-foreground text-sm">0%</p>
            <div className="absolute top-2 right-2 text-[8px] uppercase tracking-wider font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              Soon
            </div>
          </motion.div>
        </div>

        {/* ── Monthly Order Volume (Visual Placeholder - Locked) ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-2xl shadow-card p-5 space-y-4 opacity-70 grayscale-[30%] pointer-events-none relative"
        >
          <div className="absolute top-4 right-4 text-[10px] uppercase tracking-wider font-bold bg-muted px-2 py-1 rounded-md text-muted-foreground">
            Analytics Unlocking Soon
          </div>
          <h2 className="font-display text-base tracking-wide text-foreground">Monthly Order Volume</h2>
          <div className="flex items-end gap-2 h-32">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${d.value}%` }}
                  transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                  className="w-full rounded-t-lg bg-primary/40"
                />
                <span className="font-body text-[10px] text-muted-foreground">{d.month}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Live Recent Activity */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card rounded-2xl shadow-card p-5 space-y-3"
          >
            <h2 className="font-display text-base tracking-wide text-foreground">Recent Orders</h2>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No orders found.</p>
            ) : (
              recentOrders.map((order, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
                >
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground uppercase">
                      ORD-{order.id.slice(0, 6)}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">{order.status.replace("_", " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-body text-sm font-bold text-foreground">
                      {formatCurrency(order.sales_order_value)}
                    </p>
                    <span className="font-body text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => navigate("/orders")}
              className="w-full pt-2 text-xs font-bold text-primary text-center uppercase tracking-wider hover:underline"
            >
              View All Orders
            </button>
          </motion.section>

          {/* Dedicated Support Actions */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-amber-50 rounded-2xl shadow-card p-5 space-y-4 border border-amber-200/50"
          >
            <h2 className="font-display text-base tracking-wide text-amber-900">Dedicated Support</h2>
            <div className="space-y-2.5">
              <a
                href="https://wa.me/919891162212"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center gap-3 py-2 px-3 bg-white rounded-xl hover:bg-amber-100/50 transition-colors shadow-sm group"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-600">
                  <MessageCircle size={16} />
                </div>
                <span className="font-body text-sm text-amber-900 font-medium flex-1 text-left">
                  WhatsApp (+91 9891162212)
                </span>
                <ArrowUpRight size={14} className="text-amber-700/50 group-hover:text-amber-700" />
              </a>
              <a
                href="tel:+919999792959"
                className="w-full flex items-center gap-3 py-2 px-3 bg-white rounded-xl hover:bg-amber-100/50 transition-colors shadow-sm group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                  <Phone size={16} />
                </div>
                <span className="font-body text-sm text-amber-900 font-medium flex-1 text-left">
                  Call Helpdesk (+91 9999792959)
                </span>
                <ArrowUpRight size={14} className="text-amber-700/50 group-hover:text-amber-700" />
              </a>
              <a
                href="mailto:info@oasisbaklawa.com"
                className="w-full flex items-center gap-3 py-2 px-3 bg-white rounded-xl hover:bg-amber-100/50 transition-colors shadow-sm group"
              >
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 text-orange-600">
                  <Mail size={16} />
                </div>
                <span className="font-body text-sm text-amber-900 font-medium flex-1 text-left">
                  info@oasisbaklawa.com
                </span>
                <ArrowUpRight size={14} className="text-amber-700/50 group-hover:text-amber-700" />
              </a>
            </div>
          </motion.section>
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;
