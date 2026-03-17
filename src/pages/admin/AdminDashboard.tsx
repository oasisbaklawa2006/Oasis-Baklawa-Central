import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, UserCheck, ShoppingCart, DollarSign, Users, Package, Settings,
  Scale, Globe, Shield, ClipboardList, AlertTriangle, ArrowRight, LogOut,
  BarChart3, Layers
} from "lucide-react";

interface GovernanceTile {
  key: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  route: string;
  count: number | string;
  color: string;
}

interface AlertItem {
  label: string;
  count: number;
  route: string;
  severity: "high" | "medium" | "info";
}

interface AuditEntry {
  id: string;
  action_type: string | null;
  module_name: string | null;
  entity_name: string | null;
  created_at: string;
  actor_id: string | null;
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [tiles, setTiles] = useState<GovernanceTile[]>([]);
  const [extTiles, setExtTiles] = useState<GovernanceTile[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentActions, setRecentActions] = useState<AuditEntry[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    const [
      pendingApps, approvedApps, products, orders,
      unpaidOrders, dispatchReady, users, moqRules,
      exchangeRates, auditLogs, supportOpen
    ] = await Promise.all([
      supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("sales_order_value, advance_paid").neq("payment_status", "paid"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "ready_for_dispatch"),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("moq_rules").select("id", { count: "exact", head: true }),
      supabase.from("exchange_rates").select("id", { count: "exact", head: true }),
      supabase.from("audit_logs").select("id, action_type, module_name, entity_name, created_at, actor_id").order("created_at", { ascending: false }).limit(10),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);

    const unpaid = (unpaidOrders.data as { sales_order_value: number | null; advance_paid: number | null }[] | null) ?? [];
    const totalDue = unpaid.reduce((sum, o) => sum + ((o.sales_order_value ?? 0) - (o.advance_paid ?? 0)), 0);

    setTiles([
      { key: "clients", label: "Client Governance", subtitle: "Approvals, pricing slabs, credit", icon: UserCheck, route: "/admin/clients", count: pendingApps.count ?? 0, color: "hsl(40, 40%, 59%)" },
      { key: "products", label: "Product Catalog", subtitle: "SKU master, categories, packs", icon: Package, route: "/admin/products", count: products.count ?? 0, color: "hsl(220, 70%, 55%)" },
      { key: "pricing", label: "Pricing Matrix", subtitle: "Slabs, overrides, versioning", icon: BarChart3, route: "/admin/pricing", count: "—", color: "hsl(280, 60%, 55%)" },
      { key: "orders", label: "Order Control", subtitle: "Exceptions, holds, closures", icon: ShoppingCart, route: "/admin/orders", count: orders.count ?? 0, color: "hsl(150, 50%, 45%)" },
    ]);

    setExtTiles([
      { key: "finance", label: "Financial Control", subtitle: "Balances, ledger, credit exposure", icon: DollarSign, route: "/admin/finance", count: totalDue > 0 ? `₹${totalDue.toLocaleString("en-IN")}` : "₹0", color: "hsl(0, 70%, 55%)" },
      { key: "users", label: "User & Role Control", subtitle: "Roles, permissions, login history", icon: Users, route: "/admin/users", count: users.count ?? 0, color: "hsl(200, 60%, 50%)" },
      { key: "moq", label: "MOQ Rule Control", subtitle: "Product/category/pack rules", icon: Scale, route: "/admin/moq", count: moqRules.count ?? 0, color: "hsl(30, 70%, 50%)" },
      { key: "currency", label: "Currency & Exchange Rate", subtitle: "Base rates, manual source", icon: Globe, route: "/admin/currency", count: exchangeRates.count ?? 0, color: "hsl(170, 55%, 45%)" },
      { key: "settings", label: "System Settings", subtitle: "Defaults, numbering, dispatch", icon: Settings, route: "/admin/settings", count: "—", color: "hsl(250, 40%, 55%)" },
      { key: "audit", label: "Audit Trail", subtitle: "Searchable activity log", icon: Shield, route: "/admin/audit", count: auditLogs.data?.length ?? 0, color: "hsl(0, 0%, 40%)" },
    ]);

    // Alerts
    const alertItems: AlertItem[] = [];
    if ((pendingApps.count ?? 0) > 0) alertItems.push({ label: "Pending Client Approvals", count: pendingApps.count ?? 0, route: "/admin/clients", severity: "high" });
    if ((dispatchReady.count ?? 0) > 0) alertItems.push({ label: "Dispatch Ready", count: dispatchReady.count ?? 0, route: "/admin/dispatch", severity: "medium" });
    if (totalDue > 100000) alertItems.push({ label: "Outstanding Balance > ₹1L", count: Math.round(totalDue), route: "/admin/finance", severity: "high" });
    if ((supportOpen.count ?? 0) > 0) alertItems.push({ label: "Open Support Tickets", count: supportOpen.count ?? 0, route: "/admin/support", severity: "medium" });
    setAlerts(alertItems);

    setRecentActions((auditLogs.data as AuditEntry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const ch = supabase
      .channel("governance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "b2b_applications" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/splash");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  const severityColor = (s: string) => s === "high" ? "bg-destructive/10 text-destructive border-destructive/20" : s === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display-h1 text-foreground">Governance Command Center</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Super Admin — Full system authority</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-fine text-muted-foreground">System Active</span>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-ui-label text-muted-foreground hover:text-destructive transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => navigate(a.route)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-ui font-medium transition-colors hover:opacity-80 ${severityColor(a.severity)}`}
            >
              <AlertTriangle size={13} />
              {a.label}: {typeof a.count === "number" && a.count > 99999 ? `₹${(a.count / 100000).toFixed(1)}L` : a.count}
              <ArrowRight size={12} />
            </button>
          ))}
        </div>
      )}

      {/* Primary Governance Tiles */}
      <div>
        <h2 className="text-ui-h5 text-muted-foreground uppercase tracking-wider mb-3">Primary Governance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              onClick={() => navigate(tile.route)}
              className="bg-card border border-border rounded-xl p-5 text-left hover:shadow-md transition-all group"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <tile.icon size={20} style={{ color: tile.color }} />
                <span className="text-ui-kpi text-xl" style={{ color: tile.color }}>{tile.count}</span>
              </div>
              <h3 className="text-ui-h5 text-foreground group-hover:text-primary transition-colors">{tile.label}</h3>
              <p className="text-fine text-muted-foreground mt-0.5">{tile.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Extended Governance Tiles */}
      <div>
        <h2 className="text-ui-h5 text-muted-foreground uppercase tracking-wider mb-3">Extended Control</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {extTiles.map((tile) => (
            <button
              key={tile.key}
              onClick={() => navigate(tile.route)}
              className="bg-card border border-border rounded-xl p-5 text-left hover:shadow-md transition-all group"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <tile.icon size={18} style={{ color: tile.color }} />
                <span className="text-ui-kpi text-lg" style={{ color: tile.color }}>{tile.count}</span>
              </div>
              <h3 className="text-ui-h5 text-foreground group-hover:text-primary transition-colors">{tile.label}</h3>
              <p className="text-fine text-muted-foreground mt-0.5">{tile.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Critical Actions */}
      <div>
        <h2 className="text-ui-h5 text-muted-foreground uppercase tracking-wider mb-3">Recent Critical Actions</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          {recentActions.length === 0 ? (
            <p className="text-ui-label text-muted-foreground p-5">No recent activity recorded.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentActions.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardList size={14} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-ui-cell text-foreground truncate">
                        {a.action_type ?? "action"} — {a.module_name ?? "system"}{a.entity_name ? ` / ${a.entity_name}` : ""}
                      </p>
                    </div>
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
  );
};

export default AdminDashboard;
