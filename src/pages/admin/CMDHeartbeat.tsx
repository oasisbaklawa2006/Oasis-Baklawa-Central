import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, TrendingUp, AlertTriangle, Activity, Crown, AlertCircle } from "lucide-react";
import StagnancyBadge from "@/components/StagnancyBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { composePortfolioExposureFacts } from "@/lib/finance-ageing";

/* ─── Role Gate ────────────────────────────────────────────── */
function useCMDAccess() {
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("role, designation")
        .eq("id", user.id)
        .maybeSingle();
      const isSuperAdmin = data?.role === "super_admin";
      const isCMD = (data as any)?.designation === "CMD";
      setAllowed(isSuperAdmin || isCMD);
    })();
  }, [user, authLoading]);

  return { allowed, loading: authLoading || allowed === null };
}

/* ─── Types ────────────────────────────────────────────────── */
interface DeptWastage { department: string; produced: number; wastage: number; rate: number }
interface SalesExec { id: string; name: string; email: string; totalSales: number; liability: number; returnRatio: number }
interface ItchyAlert { type: "production" | "settlement"; label: string; detail: string; since: string }
interface ExceptionEntry { id: string; reason: string; created_at: string; action_type: string }

const GOLD = "hsl(40 40% 59%)";
const BURNT_ORANGE = "hsl(25 90% 50%)";
const GOLDENROD = "hsl(43 74% 49%)";
const SLATE_BG = "hsl(220 20% 12%)";
const SLATE_CARD = "hsl(220 18% 16%)";
const SLATE_BORDER = "hsl(220 14% 22%)";
const GOLD_TEXT = "hsl(40 50% 70%)";
const MUTED_TEXT = "hsl(220 10% 55%)";

const CMDHeartbeat = () => {
  const { allowed, loading: gateLoading } = useCMDAccess();
  const [loading, setLoading] = useState(true);

  // KPIs
  const [netRevenue, setNetRevenue] = useState(0);
  const [totalExposure, setTotalExposure] = useState(0);
  const [totalWastage, setTotalWastage] = useState(0);
  const [defectRatio, setDefectRatio] = useState(0);

  // Charts & Tables
  const [deptWastage, setDeptWastage] = useState<DeptWastage[]>([]);
  const [leaderboard, setLeaderboard] = useState<SalesExec[]>([]);
  const [alerts, setAlerts] = useState<ItchyAlert[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionEntry[]>([]);

  useEffect(() => {
    if (gateLoading || !allowed) return;
    fetchAll();
  }, [gateLoading, allowed]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchKPIs(), fetchWastageHeatmap(), fetchLeaderboard(), fetchAlerts(), fetchExceptions()]);
    setLoading(false);
  };

  const fetchExceptions = async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("id, reason, created_at, action_type")
      .in("action_type", ["SPECIAL_INCIDENCE", "wallet_variance_exception", "security_violation_blocked"])
      .order("created_at", { ascending: false })
      .limit(20);
    setExceptions((data as ExceptionEntry[]) ?? []);
  };

  const fetchKPIs = async () => {
    // Net Revenue: delivered orders
    const { data: delivered } = await supabase
      .from("orders")
      .select("sales_order_value")
      .eq("status", "Delivered");
    const rev = (delivered ?? []).reduce((s, o) => s + Number(o.sales_order_value || 0), 0);
    setNetRevenue(rev);

    // Total Exposure: Core companies.total_outstanding + pending settlement returns (operational adjunct)
    const { data: creditCompanies } = await supabase
      .from("companies")
      .select("id, business_name, total_outstanding, credit_limit, is_frozen")
      .eq("payment_terms", "credit");
    const exposureFacts = composePortfolioExposureFacts({ companies: creditCompanies || [] });

    const { data: pendingReturns } = await supabase
      .from("inward_material_advice")
      .select("expected_value")
      .eq("status", "inspected");
    const retVal = (pendingReturns ?? []).reduce((s, r) => s + Number(r.expected_value || 0), 0);
    setTotalExposure(exposureFacts.total_outstanding + retVal);

    // System-wide wastage
    const { data: prodLogs } = await supabase
      .from("daily_production_logs")
      .select("wastage_qty");
    const waste = (prodLogs ?? []).reduce((s, l) => s + Number(l.wastage_qty || 0), 0);
    setTotalWastage(waste);

    // Defect ratio
    const { count: defectCount } = await supabase
      .from("order_returns")
      .select("id", { count: "exact", head: true })
      .eq("is_manufacturing_defect", true);
    const { count: totalOrders } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true });
    setDefectRatio(totalOrders ? ((defectCount || 0) / totalOrders) * 100 : 0);
  };

  const fetchWastageHeatmap = async () => {
    const { data } = await supabase
      .from("daily_production_logs")
      .select("department, produced_qty, wastage_qty");
    const map: Record<string, { produced: number; wastage: number }> = {};
    (data ?? []).forEach(l => {
      if (!map[l.department]) map[l.department] = { produced: 0, wastage: 0 };
      map[l.department].produced += Number(l.produced_qty || 0);
      map[l.department].wastage += Number(l.wastage_qty || 0);
    });
    setDeptWastage(
      Object.entries(map).map(([dept, v]) => ({
        department: dept,
        produced: v.produced,
        wastage: v.wastage,
        rate: v.produced > 0 ? (v.wastage / v.produced) * 100 : 0,
      })).sort((a, b) => b.rate - a.rate)
    );
  };

  const fetchLeaderboard = async () => {
    // Get sales executives
    const { data: execs } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("role", "sales_executive");
    if (!execs?.length) { setLeaderboard([]); return; }

    // Get companies managed by each exec
    const { data: companies } = await supabase
      .from("companies")
      .select("id, account_manager_id");

    // Get all delivered orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, company_id, sales_order_value, status");

    // Get returns with sales error
    const { data: returns } = await supabase
      .from("order_returns")
      .select("order_id, loss_amount, reason");

    const board: SalesExec[] = execs.map(exec => {
      const managedCompanyIds = (companies ?? [])
        .filter(c => c.account_manager_id === exec.id)
        .map(c => c.id);

      const execOrders = (orders ?? []).filter(o => managedCompanyIds.includes(o.company_id || ""));
      const deliveredOrders = execOrders.filter(o => o.status === "Delivered");
      const totalSales = deliveredOrders.reduce((s, o) => s + Number(o.sales_order_value || 0), 0);

      const execOrderIds = execOrders.map(o => o.id);
      const execReturns = (returns ?? []).filter(r => execOrderIds.includes(r.order_id || ""));
      const salesErrorReturns = execReturns.filter(r => r.reason === "Sales Error" || r.reason === "sales_error");
      const liability = salesErrorReturns.reduce((s, r) => s + Number(r.loss_amount || 0), 0);
      const returnRatio = execOrders.length > 0 ? (execReturns.length / execOrders.length) * 100 : 0;

      return {
        id: exec.id,
        name: exec.full_name || exec.email || "Unknown",
        email: exec.email || "",
        totalSales,
        liability,
        returnRatio,
      };
    });

    setLeaderboard(board.sort((a, b) => b.totalSales - a.totalSales));
  };

  const fetchAlerts = async () => {
    const now = new Date();
    const itchy: ItchyAlert[] = [];

    // Q1: Submitted orders stagnant > 4h (Finance hasn't acted)
    const cutoff4 = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
    const { data: stagnantSubmitted } = await supabase
      .from("orders")
      .select("id, created_at, status")
      .eq("status", "submitted")
      .lt("created_at", cutoff4);
    (stagnantSubmitted ?? []).forEach(o => {
      const hrs = Math.round((now.getTime() - new Date(o.created_at!).getTime()) / 3600000);
      itchy.push({
        type: "production",
        label: `Order ${o.id.slice(0, 8).toUpperCase()}`,
        detail: `Submitted ${hrs}h ago — Finance hasn't verified`,
        since: o.created_at || "",
      });
    });

    // Orders stuck in production > 48h
    const cutoff48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { data: stuckOrders } = await supabase
      .from("orders")
      .select("id, created_at, status")
      .in("status", ["in_production", "In Production"])
      .lt("created_at", cutoff48);
    (stuckOrders ?? []).forEach(o => {
      const hrs = Math.round((now.getTime() - new Date(o.created_at!).getTime()) / 3600000);
      itchy.push({
        type: "production",
        label: `Order ${o.id.slice(0, 8).toUpperCase()}`,
        detail: `Stuck in Production for ${hrs}h`,
        since: o.created_at || "",
      });
    });

    // Settlements pending > 24h
    const cutoff24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingSettlements } = await supabase
      .from("inward_material_advice")
      .select("id, created_at, status")
      .eq("status", "inspected")
      .lt("created_at", cutoff24);
    (pendingSettlements ?? []).forEach(s => {
      const hrs = Math.round((now.getTime() - new Date(s.created_at!).getTime()) / 3600000);
      itchy.push({
        type: "settlement",
        label: `Return ${s.id.slice(0, 8).toUpperCase()}`,
        detail: `Settlement pending for ${hrs}h`,
        since: s.created_at || "",
      });
    });

    setAlerts(itchy);
  };

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  if (gateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: SLATE_BG }}>
        <Loader2 className="animate-spin" size={32} style={{ color: GOLD }} />
      </div>
    );
  }

  if (!allowed) return <Navigate to="/admin" replace />;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] -m-6 p-8" style={{ background: SLATE_BG }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Crown size={28} style={{ color: GOLD }} />
        <div>
          <h1 className="text-display-h1 tracking-tight" style={{ color: GOLD_TEXT, fontFamily: "var(--font-display)" }}>
            CMD Heartbeat
          </h1>
          <p className="text-fine mt-0.5" style={{ color: MUTED_TEXT }}>
            Executive Intelligence • Real-Time
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="animate-spin" size={28} style={{ color: GOLD }} />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* ─── Task 1: Vitals KPIs ─── */}
          <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Net Revenue", value: fmt(netRevenue), icon: TrendingUp, accent: GOLDENROD },
              { label: "Total Exposure", value: fmt(totalExposure), icon: ShieldAlert, accent: BURNT_ORANGE },
              { label: "System-Wide Wastage", value: `${totalWastage.toLocaleString("en-IN")} units`, icon: AlertTriangle, accent: "hsl(0 70% 55%)" },
              { label: "Defect Ratio", value: `${defectRatio.toFixed(2)}%`, icon: Activity, accent: defectRatio > 3 ? BURNT_ORANGE : GOLDENROD },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl p-6 border"
                style={{ background: SLATE_CARD, borderColor: SLATE_BORDER }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <kpi.icon size={16} style={{ color: kpi.accent }} />
                  <span className="text-ui-label uppercase tracking-wider" style={{ color: MUTED_TEXT }}>
                    {kpi.label}
                  </span>
                </div>
                <p className="text-3xl font-bold tracking-tight" style={{ color: GOLD_TEXT, fontFamily: "var(--font-ui)" }}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* ─── Task 2: Wastage Heatmap ─── */}
          <div className="col-span-12 lg:col-span-8 rounded-xl border p-6" style={{ background: SLATE_CARD, borderColor: SLATE_BORDER }}>
            <h3 className="text-body-h3 mb-4" style={{ color: GOLD_TEXT }}>
              Department Wastage Heatmap
            </h3>
            {deptWastage.length === 0 ? (
              <p className="text-sm py-12 text-center" style={{ color: MUTED_TEXT }}>No production data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptWastage} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 22%)" />
                  <XAxis
                    dataKey="department"
                    tick={{ fill: MUTED_TEXT, fontSize: 11, fontFamily: "var(--font-ui)" }}
                    axisLine={{ stroke: SLATE_BORDER }}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    tick={{ fill: MUTED_TEXT, fontSize: 11 }}
                    axisLine={{ stroke: SLATE_BORDER }}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      background: SLATE_CARD,
                      border: `1px solid ${SLATE_BORDER}`,
                      borderRadius: 8,
                      color: GOLD_TEXT,
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, "Wastage Rate"]}
                  />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                    {deptWastage.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.rate > 5 ? BURNT_ORANGE : entry.rate < 2 ? GOLDENROD : GOLD}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ─── Task 4: Itchy Point Alerts ─── */}
          <div className="col-span-12 lg:col-span-4 rounded-xl border p-6" style={{ background: SLATE_CARD, borderColor: SLATE_BORDER }}>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert size={16} style={{ color: BURNT_ORANGE }} />
              <h3 className="text-ui-h4" style={{ color: BURNT_ORANGE }}>
                Critical Attention Required
              </h3>
            </div>
            {alerts.length === 0 ? (
              <div className="py-12 text-center">
                <Activity size={32} className="mx-auto mb-2" style={{ color: GOLDENROD }} />
                <p className="text-sm" style={{ color: MUTED_TEXT }}>All systems nominal</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {alerts.map((a, i) => (
                   <div
                    key={i}
                    className="rounded-lg p-3 border"
                    style={{
                      borderColor: a.type === "production" ? "hsl(0 60% 40%)" : "hsl(35 60% 40%)",
                      background: a.type === "production" ? "hsl(0 40% 14%)" : "hsl(35 30% 14%)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <StagnancyBadge createdAt={a.since} />
                      <p className="text-xs font-semibold" style={{ color: a.type === "production" ? "hsl(0 70% 65%)" : "hsl(40 70% 65%)" }}>
                        {a.label}
                      </p>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: MUTED_TEXT }}>{a.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Task 3: Sales Executive Leaderboard ─── */}
          <div className="col-span-12 rounded-xl border p-6" style={{ background: SLATE_CARD, borderColor: SLATE_BORDER }}>
            <h3 className="text-body-h3 mb-4" style={{ color: GOLD_TEXT }}>
              Sales Executive Leaderboard
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: MUTED_TEXT }}>No sales executives found</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm" style={{ fontFamily: "var(--font-ui)" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${SLATE_BORDER}` }}>
                      <th className="text-left py-3 px-3 text-xs uppercase tracking-wider" style={{ color: MUTED_TEXT }}>#</th>
                      <th className="text-left py-3 px-3 text-xs uppercase tracking-wider" style={{ color: MUTED_TEXT }}>Executive</th>
                      <th className="text-right py-3 px-3 text-xs uppercase tracking-wider" style={{ color: MUTED_TEXT }}>Total Sales</th>
                      <th className="text-right py-3 px-3 text-xs uppercase tracking-wider" style={{ color: MUTED_TEXT }}>Liability</th>
                      <th className="text-right py-3 px-3 text-xs uppercase tracking-wider" style={{ color: MUTED_TEXT }}>Return Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((exec, idx) => (
                      <tr
                        key={exec.id}
                        style={{ borderBottom: `1px solid ${SLATE_BORDER}` }}
                        className="transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(220 18% 19%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="py-3 px-3 font-bold" style={{ color: idx === 0 ? GOLDENROD : MUTED_TEXT }}>
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3" style={{ color: GOLD_TEXT }}>{exec.name}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums" style={{ color: GOLDENROD }}>
                          {fmt(exec.totalSales)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums" style={{ color: exec.liability > 0 ? BURNT_ORANGE : MUTED_TEXT }}>
                          {fmt(exec.liability)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums" style={{ color: exec.returnRatio > 10 ? BURNT_ORANGE : MUTED_TEXT }}>
                          {exec.returnRatio.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exception Ticker */}
      {exceptions.length > 0 && (
        <div className="mt-6 rounded-xl border overflow-hidden" style={{ background: "hsl(0 30% 12%)", borderColor: "hsl(0 40% 25%)" }}>
          <div className="flex items-center gap-2 px-4 py-2" style={{ background: "hsl(0 40% 16%)" }}>
            <AlertCircle size={14} style={{ color: "hsl(0 70% 60%)" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "hsl(0 70% 65%)" }}>
              Exception Ticker — Special Incidences
            </span>
          </div>
          <div className="overflow-hidden whitespace-nowrap py-2 px-4">
            <div className="inline-flex gap-12 animate-marquee">
              {exceptions.map((ex) => (
                <span key={ex.id} className="text-xs" style={{ color: GOLD_TEXT }}>
                  ⚠ [{ex.action_type}] {ex.reason || "No details"} — {new Date(ex.created_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMDHeartbeat;
