import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isRealtimeEnabled } from "@/hooks/useRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { signOutAndClearSession } from "@/utils/authSession";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import {
  Loader2, LogOut, AlertTriangle, ArrowRight, ClipboardList,
  ShoppingCart, Factory, PackageCheck, Landmark, AlertCircle,
  UserCheck, Package, BarChart3, DollarSign, Users, Scale, Globe,
  Settings, Shield, Clock, TrendingUp, Gauge, Activity, Truck,
  ChevronDown, ChevronRight, X, Zap, Heart
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface AlertItem { label: string; count: number; route: string; severity: "high" | "medium" | "info"; }
interface AuditEntry { id: string; action_type: string | null; module_name: string | null; entity_name: string | null; created_at: string; }
interface MetricItem { l: string; v: number; actionable?: boolean; }

const ALL_STATUSES = [
  "submitted", "in_production", "packed_ready",
  "awaiting_final_payment", "cleared_for_dispatch",
  "dispatched", "delivered", "cancelled",
];

/* ── Animated counter ── */
const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const steps = 30;
    let step = 0;
    clearInterval(ref.current);
    ref.current = window.setInterval(() => {
      step++;
      setDisplay(Math.round(start + (diff * step) / steps));
      if (step >= steps) clearInterval(ref.current);
    }, 20);
    return () => clearInterval(ref.current);
  }, [value, display]);
  return <span className="font-number tabular-nums">{prefix}{display.toLocaleString("en-IN")}{suffix}</span>;
};

/* ── Circular Gauge ── */
const CircularGauge = ({ value, max, label, color, icon: Icon, onClick }: {
  value: number; max: number; label: string; color: string; icon: React.ElementType; onClick?: () => void;
}) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 40, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={16} className="mb-0.5" style={{ color }} />
          <span className="text-lg font-display font-semibold text-foreground"><AnimatedNumber value={value} /></span>
        </div>
      </div>
      <span className="text-xs font-ui font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">{label}</span>
    </button>
  );
};

/* ── Intelligence Pill ── */
const IntelPill = ({ label, count, severity, onClick }: { label: string; count: number; severity: string; onClick: () => void }) => {
  const base = severity === "high"
    ? "bg-red-500/10 text-red-600 border-red-200 shadow-red-100"
    : severity === "medium"
      ? "bg-amber-500/10 text-amber-700 border-amber-200 shadow-amber-100"
      : "bg-teal-500/10 text-teal-700 border-teal-200 shadow-teal-100";
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-ui font-semibold transition-all hover:scale-105 hover:shadow-md ${base}`}>
      {severity === "high" && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      {severity === "medium" && <span className="w-2 h-2 rounded-full bg-amber-500" />}
      {severity === "info" && <span className="w-2 h-2 rounded-full bg-teal-500" />}
      {label} <span className="font-number font-bold">{count}</span>
      <ArrowRight size={11} />
    </button>
  );
};

/* ── Flow Stage ── */
const FlowStage = ({ label, count, isBottleneck, isLast, onClick }: {
  label: string; count: number; isBottleneck: boolean; isLast: boolean; onClick: () => void;
}) => (
  <button onClick={onClick} className="flex-1 min-w-0 group">
    <div className="flex items-center">
      <div className={`flex-1 flex flex-col items-center px-2 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 ${isBottleneck ? "bg-red-50 border border-red-200" : "bg-card border border-border hover:border-primary/30"}`}
        style={{ boxShadow: isBottleneck ? "0 0 12px rgba(239,68,68,0.15)" : "0 2px 8px rgba(0,0,0,0.04)" }}>
        <span className={`text-xl font-display font-bold ${isBottleneck ? "text-red-600" : "text-foreground"}`}>
          <AnimatedNumber value={count} />
        </span>
        <span className="text-[10px] font-ui font-medium text-muted-foreground mt-0.5 text-center leading-tight">{label}</span>
        {isBottleneck && <span className="text-[9px] font-ui font-bold text-red-500 mt-0.5 animate-pulse">⚠ BOTTLENECK</span>}
      </div>
      {!isLast && <ChevronRight size={14} className="text-muted-foreground mx-0.5 shrink-0" />}
    </div>
  </button>
);

/* ── Drill-down Overlay ── */
const DrillOverlay = ({ title, items, onClose }: { title: string; items: { label: string; value: string | number }[]; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-foreground">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X size={18} /></button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
            <span className="text-sm font-ui text-foreground">{item.label}</span>
            <span className="text-sm font-number font-semibold text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Smart Cluster Card ── */
const ClusterCard = ({ title, icon: Icon, color, metrics, route }: {
  title: string; icon: React.ElementType; color: string; metrics: MetricItem[]; route: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const max = Math.max(...metrics.map(m => m.v), 1);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-5 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <h4 className="font-display text-base text-foreground">{title}</h4>
            <p className="text-xs font-ui text-muted-foreground mt-0.5">{metrics.reduce((s, m) => s + m.v, 0)} total items</p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-5 pb-5 space-y-3">
          {metrics.map((m) => (
            <div key={m.l} className="flex items-center gap-3">
              <span className="text-xs font-ui text-muted-foreground w-32 truncate">{m.l}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((m.v / max) * 100, 100)}%`, backgroundColor: m.actionable ? "#dc2626" : color }} />
              </div>
              <span className={`text-xs font-number font-semibold w-8 text-right ${m.actionable ? "text-red-600" : "text-foreground"}`}>{m.v}</span>
            </div>
          ))}
          <button onClick={() => navigate(route)} className="flex items-center gap-1.5 text-xs font-ui font-semibold text-primary hover:underline mt-2">
            Open Full View <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentActions, setRecentActions] = useState<AuditEntry[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Record<string, number | string>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [drillTarget, setDrillTarget] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { format } = useCurrency();

  const fetchData = useCallback(async () => {
    const [pendingApps, products, allOrders, unpaidOrders, supportOpen, users, moqRules, exchangeRates, auditLogs, pricingSlabs, inventoryRes, slaBreached] = await Promise.all([
      supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id, status, payment_status, sales_order_value, advance_paid, advance_required"),
      supabase.from("orders").select("sales_order_value, advance_paid").neq("payment_status", "paid"),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("moq_rules").select("id", { count: "exact", head: true }),
      supabase.from("exchange_rates").select("id", { count: "exact", head: true }),
      supabase.from("audit_logs").select("id, action_type, module_name, entity_name, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("pricing_slabs").select("id", { count: "exact", head: true }),
      supabase.from("factory_inventory").select("product_id, quantity"),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "resolved").lt("sla_resolution_due", new Date().toISOString()),
    ]);

    const orders = (allOrders.data ?? []) as { id: string; status: string; payment_status: string | null; sales_order_value: number | null; advance_paid: number | null; advance_required: number | null }[];
    const actionableOrders = orders.filter(o => !["draft", "cart", "cancelled"].includes(o.status));
    const pc: Record<string, number> = {};
    ALL_STATUSES.forEach(s => pc[s] = 0);
    actionableOrders.forEach(o => { if (o.status in pc) pc[o.status]++; });
    setPipeline(pc);

    const invRows = (inventoryRes.data ?? []) as { product_id: string | null; quantity: number | null }[];
    const stockMap: Record<string, number> = {};
    invRows.forEach(r => { if (r.product_id) stockMap[r.product_id] = (stockMap[r.product_id] || 0) + (Number(r.quantity) || 0); });
    const totalPhysicalStock = Object.values(stockMap).reduce((s, v) => s + v, 0);
    const lowStockCount = Object.values(stockMap).filter(v => v < 10).length;

    const immediateCash = orders.filter(o => o.status === "submitted").reduce((s, o) => s + (o.advance_required ?? 0), 0);
    const pendingCollections = orders.filter(o => o.status === "dispatched").reduce((s, o) => s + ((o.sales_order_value ?? 0) - (o.advance_paid ?? 0)), 0);
    const unpaid = (unpaidOrders.data ?? []) as { sales_order_value: number | null; advance_paid: number | null }[];
    const totalDue = unpaid.reduce((s, o) => s + ((o.sales_order_value ?? 0) - (o.advance_paid ?? 0)), 0);
    const financeHold = orders.filter(o => (o.advance_required ?? 0) > 0 && (o.advance_paid ?? 0) < (o.advance_required ?? 0)).length;

    setCounts({
      pendingApps: pendingApps.count ?? 0, products: products.count ?? 0,
      pricingSlabs: pricingSlabs.count ?? 0, totalOrders: actionableOrders.length,
      users: users.count ?? 0, moqRules: moqRules.count ?? 0,
      exchangeRates: exchangeRates.count ?? 0, supportOpen: supportOpen.count ?? 0,
      slaBreached: slaBreached.count ?? 0,
      totalDue, financeHold, totalPhysicalStock, lowStockCount, immediateCash, pendingCollections,
    });

    const a: AlertItem[] = [];
    if ((pendingApps.count ?? 0) > 0) a.push({ label: "Pending Approvals", count: pendingApps.count ?? 0, route: "/admin/clients", severity: "high" });
    if (pc.awaiting_final_payment > 0) a.push({ label: "Awaiting Payment", count: pc.awaiting_final_payment, route: "/admin/accounts-release", severity: "high" });
    if (pc.cleared_for_dispatch > 0) a.push({ label: t("Dispatch Ready"), count: pc.cleared_for_dispatch, route: "/admin/packing-dispatch", severity: "medium" });
    if (financeHold > 0) a.push({ label: "Finance Hold", count: financeHold, route: "/admin/accounts-release", severity: "high" });
    if ((supportOpen.count ?? 0) > 0) a.push({ label: "Support Escalations", count: supportOpen.count ?? 0, route: "/admin/exceptions", severity: "medium" });
    if ((slaBreached.count ?? 0) > 0) a.push({ label: "SLA Breached", count: slaBreached.count ?? 0, route: "/admin/support", severity: "high" });
    if (lowStockCount > 0) a.push({ label: "Low Stock", count: lowStockCount, route: "/admin/inventory", severity: "high" });
    if (pc.packed_ready > 0 && pc.packed_ready > 3 * (pc.dispatched || 1)) {
      a.push({ label: "Dispatch Bottleneck", count: pc.packed_ready, route: "/admin/packing-dispatch", severity: "medium" });
    }
    setAlerts(a);
    setRecentActions((auditLogs.data as AuditEntry[]) ?? []);
    setLastUpdated(new Date());
    setLoading(false);
  }, [t]);

  useEffect(() => {
    setLoadTimeout(false);
    const timer = setTimeout(() => { if (loading) setLoadTimeout(true); }, 10000);
    fetchData().finally(() => clearTimeout(timer));

    if (!isRealtimeEnabled) {
      return () => clearTimeout(timer);
    }

    const channelName = "governance-rt";
    removeDuplicateRealtimeChannel(channelName);
    const ch = supabase.channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "b2b_applications" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "factory_inventory" }, () => fetchData())
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  const handleLogout = async () => { await signOutAndClearSession(); navigate("/splash"); };

  const handleRetry = () => {
    setLoadTimeout(false);
    setLoading(true);
    fetchData();
  };

  if (loading && !loadTimeout) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  if (loading && loadTimeout) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertTriangle size={32} className="text-amber-500" />
      <p className="text-sm font-ui text-muted-foreground">Connection is taking longer than expected.</p>
      <button onClick={handleRetry} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-ui font-medium hover:bg-primary/90 transition-colors">
        Retry Connection
      </button>
    </div>
  );

  const fmtNum = (n: number) => n > 99999 ? `₹${(n / 100000).toFixed(1)}L` : n.toLocaleString("en-IN");

  /* Drill-down data */
  const drillData: Record<string, { title: string; items: { label: string; value: string | number }[] }> = {
    financeHold: {
      title: "Finance Hold — Breakdown",
      items: [
        { label: "Orders Blocked", value: Number(counts.financeHold) || 0 },
        { label: "Immediate Cash Required", value: fmtNum(Number(counts.immediateCash) || 0) },
        { label: "Pending Collections", value: fmtNum(Number(counts.pendingCollections) || 0) },
        { label: "Total Outstanding", value: fmtNum(Number(counts.totalDue) || 0) },
      ],
    },
    dispatchReady: {
      title: "Dispatch Ready — Details",
      items: [
        { label: "Packed & Ready", value: pipeline.packed_ready ?? 0 },
        { label: "Cleared for Dispatch", value: pipeline.cleared_for_dispatch ?? 0 },
        { label: "Finance Blocked", value: Number(counts.financeHold) || 0 },
      ],
    },
    lowStock: {
      title: "Stock Health — Details",
      items: [
        { label: "Total Physical Stock", value: Number(counts.totalPhysicalStock) || 0 },
        { label: "Low Stock Products", value: Number(counts.lowStockCount) || 0 },
      ],
    },
  };

  const flowStages = [
    { label: "Submitted", key: "submitted", route: "/admin/order-management" },
    { label: "Production", key: "in_production", route: "/admin/order-management?view=production" },
    { label: "Packed", key: "packed_ready", route: "/admin/order-management?view=packing" },
    { label: "Payment", key: "awaiting_final_payment", route: "/admin/accounts-release" },
    { label: "Cleared", key: "cleared_for_dispatch", route: "/admin/order-management?view=packing" },
    { label: "Dispatched", key: "dispatched", route: "/admin/order-management" },
  ];

  const totalPipeline = flowStages.reduce((s, st) => s + (pipeline[st.key] ?? 0), 0);
  const avgFlow = totalPipeline / Math.max(flowStages.length, 1);

  const governanceTiles = [
    { key: "clients", label: t("Client Governance"), icon: UserCheck, route: "/admin/clients", count: counts.pendingApps, desc: "Approvals, pricing, credit" },
    { key: "products", label: t("Product Catalog"), icon: Package, route: "/admin/products", count: counts.products, desc: "SKU master & categories" },
    { key: "pricing", label: t("Pricing Matrix"), icon: BarChart3, route: "/admin/pricing", count: counts.pricingSlabs, desc: "Slabs & overrides" },
    { key: "finance", label: t("Financial Control"), icon: DollarSign, route: "/admin/finance", count: typeof counts.totalDue === "number" && counts.totalDue > 0 ? fmtNum(counts.totalDue as number) : "₹0", desc: "Balances & ledger" },
    { key: "users", label: t("User & Role Control"), icon: Users, route: "/admin/users", count: counts.users, desc: "Roles & access" },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ─── HEADER ─── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl text-foreground tracking-tight">{t("Command Center")}</h1>
          <p className="text-xs font-ui text-muted-foreground mt-1">Super Admin — Full system authority</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-ui text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-2 justify-end mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-ui text-muted-foreground">Live</span>
              {lastUpdated && (
                <>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <Clock size={10} className="text-muted-foreground" />
                  <span className="text-[10px] font-number text-muted-foreground">
                    {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </>
              )}
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-ui text-muted-foreground hover:text-destructive transition-colors">
            <LogOut size={14} /> {t("Sign Out")}
          </button>
        </div>
      </div>

      {/* ─── LAYER 1: INTELLIGENCE COMMAND BAR ─── */}
      {alerts.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-primary" />
            <span className="text-xs font-ui font-semibold text-foreground uppercase tracking-wider">Intelligence Strip</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) => (
              <IntelPill key={i} label={a.label} count={a.count} severity={a.severity}
                onClick={() => {
                  if (a.label.includes("Finance")) setDrillTarget("financeHold");
                  else if (a.label.includes("Dispatch")) setDrillTarget("dispatchReady");
                  else if (a.label.includes("Stock")) setDrillTarget("lowStock");
                  else navigate(a.route);
                }} />
            ))}
          </div>
        </div>
      )}

      {/* ─── LAYER 2: DECISION METERS ─── */}
      <div>
        <h2 className="text-xs font-ui font-semibold text-muted-foreground uppercase tracking-wider mb-3">Decision Meters</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <CircularGauge value={Number(counts.totalOrders) || 0} max={Math.max(Number(counts.totalOrders) || 1, 50)} label="Revenue Pipeline" color="hsl(var(--primary))" icon={TrendingUp} onClick={() => navigate("/admin/order-management")} />
          <CircularGauge value={Number(counts.totalDue) > 0 ? Math.round(Number(counts.totalDue) / 1000) : 0} max={500} label="Exposure (₹K)" color="#dc2626" icon={AlertTriangle} onClick={() => setDrillTarget("financeHold")} />
          <CircularGauge value={totalPipeline} max={Math.max(totalPipeline, 20)} label="Ops Load" color="hsl(var(--secondary))" icon={Gauge} onClick={() => navigate("/admin/order-management")} />
          <CircularGauge value={pipeline.cleared_for_dispatch ?? 0} max={Math.max(pipeline.packed_ready ?? 1, 1)} label="Dispatch Efficiency" color="#0ea5e9" icon={Truck} onClick={() => setDrillTarget("dispatchReady")} />
          <CircularGauge value={Number(counts.slaBreached) || 0} max={Math.max(Number(counts.supportOpen) || 1, 5)} label="System Health" color={Number(counts.slaBreached) > 0 ? "#dc2626" : "#10b981"} icon={Activity} onClick={() => navigate("/admin/support")} />
          <CircularGauge value={Number(counts.totalPhysicalStock) || 0} max={Math.max(Number(counts.totalPhysicalStock) || 1, 100)} label="Stock Health" color="#8b5cf6" icon={Heart} onClick={() => setDrillTarget("lowStock")} />
        </div>
      </div>

      {/* ─── LAYER 3: ANIMATED FLOW VISUALIZATION ─── */}
      <div className="bg-card rounded-2xl border border-border p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-ui font-semibold text-muted-foreground uppercase tracking-wider">Order Flow Pipeline</h2>
          <span className="text-xs font-number text-muted-foreground">{totalPipeline} active orders</span>
        </div>
        <div className="flex items-stretch gap-1">
          {flowStages.map((st, i) => (
            <FlowStage key={st.key} label={st.label} count={pipeline[st.key] ?? 0}
              isBottleneck={(pipeline[st.key] ?? 0) > avgFlow * 2 && (pipeline[st.key] ?? 0) > 2}
              isLast={i === flowStages.length - 1}
              onClick={() => navigate(st.route)} />
          ))}
        </div>
      </div>

      {/* ─── LAYER 4: SMART CLUSTERS ─── */}
      <div>
        <h2 className="text-xs font-ui font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operations Grid</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ClusterCard title="Production & Assembly" icon={Factory} color="hsl(var(--secondary))" route="/admin/order-management?view=production" metrics={[
            { l: "In Production", v: pipeline.in_production ?? 0 },
            { l: "Packed Ready", v: pipeline.packed_ready ?? 0 },
            { l: "Total Stock", v: Number(counts.totalPhysicalStock) || 0 },
            { l: "Low Stock ⚠", v: Number(counts.lowStockCount) || 0, actionable: true },
          ]} />
          <ClusterCard title="Packing & Dispatch" icon={PackageCheck} color="#0ea5e9" route="/admin/order-management?view=packing" metrics={[
            { l: "Packed Ready", v: pipeline.packed_ready ?? 0 },
            { l: "Cleared", v: pipeline.cleared_for_dispatch ?? 0 },
            { l: "Finance Blocked", v: Number(counts.financeHold) || 0, actionable: true },
            { l: "Dispatched", v: pipeline.dispatched ?? 0 },
          ]} />
          <ClusterCard title="Finance Control" icon={Landmark} color="#dc2626" route="/admin/accounts-release" metrics={[
            { l: "Awaiting Payment", v: pipeline.awaiting_final_payment ?? 0, actionable: true },
            { l: "Finance Hold", v: Number(counts.financeHold) || 0, actionable: true },
            { l: "Exposure (₹K)", v: Math.round((Number(counts.totalDue) || 0) / 1000) },
            { l: "Pending Collections (₹K)", v: Math.round((Number(counts.pendingCollections) || 0) / 1000) },
          ]} />
        </div>
      </div>

      {/* ─── LAYER 5: GOVERNANCE (TABBED) ─── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <Tabs defaultValue="clients">
          <div className="px-5 pt-4 pb-0">
            <h2 className="text-xs font-ui font-semibold text-muted-foreground uppercase tracking-wider mb-3">Governance Panel</h2>
            <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto">
              {governanceTiles.map(g => (
                <TabsTrigger key={g.key} value={g.key} className="text-xs font-ui data-[state=active]:text-primary">
                  <g.icon size={13} className="mr-1.5" />{g.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {governanceTiles.map(g => (
            <TabsContent key={g.key} value={g.key} className="px-5 pb-5 pt-3">
              <button onClick={() => navigate(g.route)} className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <g.icon size={20} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-display text-base text-foreground">{g.label}</h4>
                      <p className="text-xs font-ui text-muted-foreground">{g.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-number font-bold text-primary">{g.count}</span>
                    <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </button>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* ─── LAYER 6: RULES & CONTROLS (ACCORDION) ─── */}
      <Accordion type="single" collapsible className="bg-card rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <AccordionItem value="rules" className="border-b-0">
          <AccordionTrigger className="px-5 py-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-primary" />
              <span className="text-xs font-ui font-semibold text-muted-foreground uppercase tracking-wider">Rules & Controls</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: t("MOQ Rules"), icon: Scale, route: "/admin/moq", count: counts.moqRules },
                { label: t("Currency"), icon: Globe, route: "/admin/currency", count: counts.exchangeRates },
                { label: t("Settings"), icon: Settings, route: "/admin/settings", count: "—" },
                { label: t("Audit Trail"), icon: Shield, route: "/admin/audit", count: recentActions.length },
              ].map(tile => (
                <button key={tile.label} onClick={() => navigate(tile.route)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all text-left group">
                  <tile.icon size={18} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-ui font-medium text-foreground group-hover:text-primary transition-colors">{tile.label}</h5>
                  </div>
                  <span className="text-sm font-number font-semibold text-primary">{tile.count}</span>
                </button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ─── RECENT ACTIONS ─── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Shield size={14} className="text-primary" />
          <h3 className="text-xs font-ui font-semibold text-foreground uppercase tracking-wider">{t("Recent Critical Actions")}</h3>
        </div>
        {recentActions.length === 0 ? (
          <p className="text-xs font-ui text-muted-foreground p-5">No recent activity.</p>
        ) : (
          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {recentActions.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardList size={13} className="text-muted-foreground shrink-0" />
                  <p className="text-xs font-ui text-foreground truncate">
                    {a.action_type ?? "action"} — {a.module_name ?? "system"}{a.entity_name ? ` / ${a.entity_name}` : ""}
                  </p>
                </div>
                <span className="text-[10px] font-number text-muted-foreground shrink-0 ml-3">
                  {new Date(a.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── DRILL-DOWN OVERLAY ─── */}
      {drillTarget && drillData[drillTarget] && (
        <DrillOverlay title={drillData[drillTarget].title} items={drillData[drillTarget].items} onClose={() => setDrillTarget(null)} />
      )}
    </div>
  );
};

export default AdminDashboard;
