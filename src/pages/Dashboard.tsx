import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { TrendingUp, Wallet, CreditCard, Share2, Headphones, FileText, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const heroMetrics = [
  { label: "Lifetime Value", value: "₹12,45,000", icon: TrendingUp },
  { label: "Wallet Balance", value: "₹45,000", icon: Wallet },
  { label: "Credit Usage", value: "30%", icon: CreditCard },
];

const recentActivity = [
  { text: "Advance Paid — ORD-089", time: "2h ago" },
  { text: "Dispatched — ORD-074", time: "1d ago" },
  { text: "New Price List Published", time: "3d ago" },
];

const quickActions = [
  { label: "Share Invoice to WhatsApp", icon: Share2, route: "" },
  { label: "Request Support", icon: Headphones, route: "" },
  { label: "View Price List", icon: FileText, route: "" },
  { label: "View All Documents", icon: FileText, route: "/documents" },
];

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
  return (
  <AppShell>
    <div className="px-5 py-6 space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-xl md:text-2xl tracking-wide text-foreground leading-tight"
      >
        Your Business with<br />Oasis Baklawa
      </motion.h1>

      {/* ── Hero Metrics ── */}
      <div className="grid grid-cols-3 gap-3">
        {heroMetrics.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card rounded-2xl shadow-card p-4 space-y-2"
          >
            <m.icon size={18} className="text-primary" />
            <p className="font-body text-[11px] text-muted-foreground leading-tight">{m.label}</p>
            <p className="font-body font-bold text-foreground text-sm">{m.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Monthly Order Volume ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card rounded-2xl shadow-card p-5 space-y-4"
      >
        <h2 className="font-display text-base tracking-wide text-foreground">Monthly Order Volume</h2>
        <div className="flex items-end gap-2 h-32">
          {monthlyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${d.value}%` }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                className="w-full rounded-t-lg bg-primary/80"
              />
              <span className="font-body text-[10px] text-muted-foreground">{d.month}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card rounded-2xl shadow-card p-5 space-y-3"
        >
          <h2 className="font-display text-base tracking-wide text-foreground">Recent Activity</h2>
          {recentActivity.map((a, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <p className="font-body text-sm text-foreground">{a.text}</p>
              <span className="font-body text-[11px] text-muted-foreground flex-shrink-0 ml-2">{a.time}</span>
            </div>
          ))}
        </motion.section>

        {/* Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl shadow-card p-5 space-y-3"
        >
          <h2 className="font-display text-base tracking-wide text-foreground">Quick Actions</h2>
          {quickActions.map((q, i) => (
            <button
              key={i}
              onClick={() => q.route && navigate(q.route)}
              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <q.icon size={16} className="text-primary" />
              </div>
              <span className="font-body text-sm text-foreground flex-1 text-left">{q.label}</span>
              <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </motion.section>
      </div>
    </div>
  </AppShell>
);

export default Dashboard;
