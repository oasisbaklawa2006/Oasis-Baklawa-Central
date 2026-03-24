import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import {
  Loader2, LogOut, AlertTriangle, ArrowRight, ClipboardList,
  ShoppingCart, Factory, PackageCheck, Landmark, AlertCircle,
  UserCheck, Package, BarChart3, DollarSign, Users, Scale, Globe,
  Languages, Settings, Shield
} from "lucide-react";

interface AlertItem { label: string; count: number; route: string; severity: "high" | "medium" | "info"; }
interface AuditEntry { id: string; action_type: string | null; module_name: string | null; entity_name: string | null; created_at: string; }

const ALL_STATUSES = [
  "submitted", "in_production", "packed_ready",
  "awaiting_final_payment", "cleared_for_dispatch",
  "dispatched", "delivered", "cancelled",
];

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentActions, setRecentActions] = useState<AuditEntry[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Record<string, number | string>>({});
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { format } = useCurrency();

  const fetchData = useCallback(async () => {
    const [pendingApps, products, allOrders, unpaidOrders, supportOpen, users, moqRules, exchangeRates, auditLogs, pricingSlabs] = await Promise.all([
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
    ]);

    const orders = (allOrders.data ?? []) as { id: string; status: string; payment_status: string | null; sales_order_value: number | null; advance_paid: number | null; advance_required: number | null }[];
    const pc: Record<string, number> = {};
    ALL_STATUSES.forEach(s => pc[s] = 0);
    orders.forEach(o => { if (o.status in pc) pc[o.status]++; });
    setPipeline(pc);

    const unpaid = (unpaidOrders.data ?? []) as { sales_order_value: number | null; advance_paid: number | null }[];
    const totalDue = unpaid.reduce((s, o) => s + ((o.sales_order_value ?? 0) - (o.advance_paid ?? 0)), 0);
    const financeHold = orders.filter(o => (o.advance_required ?? 0) > 0 && (o.advance_paid ?? 0) < (o.advance_required ?? 0)).length;

    setCounts({
      pendingApps: pendingApps.count ?? 0, products: products.count ?? 0,
      pricingSlabs: pricingSlabs.count ?? 0, totalOrders: orders.length,
      users: users.count ?? 0, moqRules: moqRules.count ?? 0,
      exchangeRates: exchangeRates.count ?? 0, supportOpen: supportOpen.count ?? 0,
      totalDue, financeHold,
    });

    const a: AlertItem[] = [];
    if ((pendingApps.count ?? 0) > 0) a.push({ label: "Pending Approvals", count: pendingApps.count ?? 0, route: "/admin/clients", severity: "high" });
    if (pc.awaiting_final_payment > 0) a.push({ label: "Awaiting Final Payment", count: pc.awaiting_final_payment, route: "/admin/accounts-release", severity: "high" });
    if (pc.cleared_for_dispatch > 0) a.push({ label: t("Dispatch Ready"), count: pc.cleared_for_dispatch, route: "/admin/packing-dispatch", severity: "medium" });
    if (financeHold > 0) a.push({ label: "Finance Hold", count: financeHold, route: "/admin/accounts-release", severity: "high" });
    if ((supportOpen.count ?? 0) > 0) a.push({ label: "Support Escalations", count: supportOpen.count ?? 0, route: "/admin/exceptions", severity: "medium" });
    setAlerts(a);
    setRecentActions((auditLogs.data as AuditEntry[]) ?? []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel("governance-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "b2b_applications" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/splash"); };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  const severityColor = (s: string) => s === "high" ? "bg-destructive/10 text-destructive border-destructive/20" : s === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200";
  const fmtNum = (n: number) => n > 99999 ? `₹${(n / 100000).toFixed(1)}L` : n.toLocaleString("en-IN");

  const operationalTiles = [
    { key: "pipeline", label: t("Order Pipeline"), icon: ShoppingCart, subtitle: "Stage-wise order flow",
      metrics: [
        { l: "Submitted", v: pipeline.submitted ?? 0 },
        { l: t("In Production"), v: pipeline.in_production ?? 0 },
        { l: "Packed Ready", v: pipeline.packed_ready ?? 0 },
        { l: "Awaiting Payment", v: pipeline.awaiting_final_payment ?? 0 },
        { l: "Cleared", v: pipeline.cleared_for_dispatch ?? 0 },
        { l: t("Dispatched"), v: pipeline.dispatched ?? 0 },
      ],
      route: "/admin/orders",
    },
    { key: "production", label: t("Production & Assembly"), icon: Factory, subtitle: "Manufacturing workload",
      metrics: [
        { l: "In Production", v: pipeline.in_production ?? 0 },
        { l: "Packed Ready", v: pipeline.packed_ready ?? 0 },
      ],
      route: "/admin/production",
    },
    { key: "packing", label: t("Packing & Dispatch"), icon: PackageCheck, subtitle: "Fulfillment workload",
      metrics: [
        { l: t("Packing"), v: pipeline.packing ?? 0 },
        { l: t("Dispatch Ready"), v: pipeline.ready_for_dispatch ?? 0 },
        { l: "Blocked", v: Number(counts.financeHold) || 0 },
      ],
      route: "/admin/packing-dispatch",
    },
    { key: "accounts", label: t("Accounts & Release"), icon: Landmark, subtitle: "Finance release control",
      metrics: [
        { l: "Advance Pending", v: pipeline.awaiting_advance ?? 0 },
        { l: "Finance Hold", v: Number(counts.financeHold) || 0 },
      ],
      route: "/admin/accounts-release",
    },
    { key: "exceptions", label: t("Exception Center"), icon: AlertCircle, subtitle: "Escalations & overrides",
      metrics: [
        { l: "Support Open", v: Number(counts.supportOpen) || 0 },
        { l: "Cancelled", v: pipeline.cancelled ?? 0 },
      ],
      route: "/admin/exceptions",
    },
  ];

  const governanceTiles = [
    { key: "clients", label: t("Client Governance"), subtitle: "Approvals, pricing, credit", icon: UserCheck, route: "/admin/clients", count: counts.pendingApps },
    { key: "products", label: t("Product Catalog"), subtitle: "SKU master, categories", icon: Package, route: "/admin/products", count: counts.products },
    { key: "pricing", label: t("Pricing Matrix"), subtitle: "Slabs, overrides, versioning", icon: BarChart3, route: "/admin/pricing", count: counts.pricingSlabs },
    { key: "finance", label: t("Financial Control"), subtitle: "Balances, ledger, credit", icon: DollarSign, route: "/admin/finance", count: typeof counts.totalDue === "number" && counts.totalDue > 0 ? format(counts.totalDue as number) : "₹0" },
    { key: "users", label: t("User & Role Control"), subtitle: "Roles, permissions, access", icon: Users, route: "/admin/users", count: counts.users },
  ];

  const rulesTiles = [
    { key: "moq", label: t("MOQ Rule Control"), subtitle: "Product / category / pack rules", icon: Scale, route: "/admin/moq", count: counts.moqRules },
    { key: "currency", label: t("Currency & Exchange Rate"), subtitle: "INR / USD rates", icon: Globe, route: "/admin/currency", count: counts.exchangeRates },
    { key: "language", label: t("Language & Localization"), subtitle: "EN / HI toggle", icon: Languages, route: "/admin/settings", count: "—" },
    { key: "settings", label: t("System Settings"), subtitle: "Defaults, numbering, dispatch", icon: Settings, route: "/admin/settings", count: "—" },
  ];

  const maxMetric = (metrics: { v: number }[]) => Math.max(...metrics.map(m => m.v), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display-h1 text-foreground">{t("Governance Command Center")}</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Super Admin — Full system authority</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-fine text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-2 justify-end mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-fine text-muted-foreground">System Active</span>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-ui-label text-muted-foreground hover:text-destructive transition-colors">
            <LogOut size={14} /> {t("Sign Out")}
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <button key={i} onClick={() => navigate(a.route)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-ui font-medium transition-colors hover:opacity-80 ${severityColor(a.severity)}`}>
              <AlertTriangle size={13} /> {a.label}: {a.count} <ArrowRight size={12} />
            </button>
          ))}
        </div>
      )}

      {/* Row 1 — Operational Command */}
      <div>
        <h2 className="text-ui-h5 text-muted-foreground uppercase tracking-wider mb-3">{t("Operational Command")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {operationalTiles.map((tile) => {
            const max = maxMetric(tile.metrics);
            return (
              <button key={tile.key} onClick={() => navigate(tile.route)}
                className="bg-card border border-border rounded-xl p-4 text-left hover:shadow-md transition-all group"
                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between mb-3">
                  <tile.icon size={18} className="text-primary" />
                  <span className="text-ui-kpi text-lg text-primary">{tile.metrics.reduce((s, m) => s + m.v, 0)}</span>
                </div>
                <h3 className="text-ui-h5 text-foreground group-hover:text-primary transition-colors text-sm">{tile.label}</h3>
                <p className="text-fine text-muted-foreground mt-0.5 mb-3">{tile.subtitle}</p>
                <div className="space-y-1.5">
                  {tile.metrics.map((m) => (
                    <div key={m.l} className="flex items-center gap-2">
                      <span className="text-fine text-muted-foreground w-24 truncate">{m.l}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${Math.min((m.v / max) * 100, 100)}%` }} />
                      </div>
                      <span className="text-fine text-foreground w-5 text-right">{m.v}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2 — Governance */}
      <div>
        <h2 className="text-ui-h5 text-muted-foreground uppercase tracking-wider mb-3">{t("Governance")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {governanceTiles.map((tile) => (
            <button key={tile.key} onClick={() => navigate(tile.route)}
              className="bg-card border border-border rounded-xl p-5 text-left hover:shadow-md transition-all group"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-3">
                <tile.icon size={18} className="text-primary" />
                <span className="text-ui-kpi text-lg text-primary">{tile.count}</span>
              </div>
              <h3 className="text-ui-h5 text-foreground group-hover:text-primary transition-colors">{tile.label}</h3>
              <p className="text-fine text-muted-foreground mt-0.5">{tile.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Row 3 — Rules & Controls */}
      <div>
        <h2 className="text-ui-h5 text-muted-foreground uppercase tracking-wider mb-3">{t("Rules & Controls")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rulesTiles.map((tile) => (
            <button key={tile.key} onClick={() => navigate(tile.route)}
              className="bg-card border border-border rounded-xl p-5 text-left hover:shadow-md transition-all group"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-3">
                <tile.icon size={18} className="text-primary" />
                <span className="text-ui-kpi text-lg text-primary">{tile.count}</span>
              </div>
              <h3 className="text-ui-h5 text-foreground group-hover:text-primary transition-colors">{tile.label}</h3>
              <p className="text-fine text-muted-foreground mt-0.5">{tile.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Row 4 — Oversight */}
      <div>
        <h2 className="text-ui-h5 text-muted-foreground uppercase tracking-wider mb-3">{t("Oversight")}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <button onClick={() => navigate("/admin/audit")}
            className="bg-card border border-border rounded-xl p-5 text-left hover:shadow-md transition-all group"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-2">
              <Shield size={18} className="text-primary" />
              <span className="text-ui-kpi text-lg text-primary">{recentActions.length}</span>
            </div>
            <h3 className="text-ui-h5 text-foreground group-hover:text-primary transition-colors">{t("Audit Trail")}</h3>
            <p className="text-fine text-muted-foreground mt-0.5">Searchable activity log</p>
          </button>
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-3 border-b border-border"><h3 className="text-ui-h5 text-foreground">{t("Recent Critical Actions")}</h3></div>
            {recentActions.length === 0 ? (
              <p className="text-ui-label text-muted-foreground p-5">No recent activity.</p>
            ) : (
              <div className="divide-y divide-border max-h-48 overflow-y-auto">
                {recentActions.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <ClipboardList size={13} className="text-muted-foreground shrink-0" />
                      <p className="text-ui-cell text-foreground truncate text-xs">
                        {a.action_type ?? "action"} — {a.module_name ?? "system"}{a.entity_name ? ` / ${a.entity_name}` : ""}
                      </p>
                    </div>
                    <span className="text-fine text-muted-foreground shrink-0 ml-3">
                      {new Date(a.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
