import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/auth-routing";
import {
  Loader2, TrendingUp, Shield, AlertTriangle, Users, RotateCcw, IndianRupee, ClipboardList,
} from "lucide-react";
import InwardAdviceModal from "@/components/sales/InwardAdviceModal";
import ClientInteractionsTab from "@/components/sales/ClientInteractionsTab";
import SalesIntelligencePanel from "@/components/sales/SalesIntelligencePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";
import { getWalletBalance } from "@/lib/order-authority/creditWalletAuthorityClient";

/* ─── Types ─── */
interface Manager {
  id: string;
  full_name: string | null;
  name: string | null;
  commission_rate_percentage: number | null;
}
interface Company {
  id: string;
  business_name: string;
  wallet_balance: number | null;
  account_manager_id: string | null;
}
interface OrderRow {
  id: string;
  company_id: string | null;
  status: string;
  sales_order_value: number | null;
  created_at: string | null;
  payment_status: string | null;
}

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "OWNER", "ADMIN"]);
const SALES_EXECUTIVE_ROLE = "SALES_EXECUTIVE";

const SalesPerformanceHub = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [returns, setReturns] = useState<{ order_id: string | null; quantity_returned: number; loss_amount: number | null; original_value: number | null; final_credit_value: number | null; product_id: string | null }[]>([]);
  const [inwardAdvices, setInwardAdvices] = useState<{ id: string; expected_value: number | null; settlement_value: number | null; fault_attribution: string | null; status: string | null }[]>([]);
  const [commissionRate, setCommissionRate] = useState(0);

  // Return logger modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showAdviceModal, setShowAdviceModal] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState("");
  const [returnProductId, setReturnProductId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  const normalizedRole = useMemo(() => normalizeRole(myRole), [myRole]);
  const isAdmin = normalizedRole ? ADMIN_ROLES.has(normalizedRole) : false;
  const isSalesExecutive = normalizedRole === SALES_EXECUTIVE_ROLE;
  const canUseHub = isAdmin || isSalesExecutive;
  const effectiveManagerId = isAdmin ? selectedManagerId : isSalesExecutive ? user?.id ?? null : null;

  // 1. Load user role & managers
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: u } = await supabase.from("users").select("role, commission_rate_percentage").eq("id", user.id).single();
      const resolvedRole = normalizeRole(u?.role);
      setMyRole(resolvedRole);
      setCommissionRate(u?.commission_rate_percentage || 0);

      if (resolvedRole === SALES_EXECUTIVE_ROLE) {
        setSelectedManagerId(user.id);
        setManagers([]);
        return;
      }

      if (resolvedRole && ADMIN_ROLES.has(resolvedRole)) {
        // Fetch managers list only for admin/owner roles. Include legacy lowercase values to survive old seed data.
        const { data: mgrs } = await supabase
          .from("users")
          .select("id, full_name, name, commission_rate_percentage")
          .in("role", ["SALES_EXECUTIVE", "sales_executive", "ADMIN", "admin", "SUPER_ADMIN", "super_admin", "OWNER", "owner"]);
        if (mgrs) setManagers(mgrs);
      }
    })();
  }, [user]);

  // 2. Load data when manager selected
  useEffect(() => {
    if (!user || !normalizedRole) return;
    if (!canUseHub) { setLoading(false); return; }
    if (!effectiveManagerId) { setLoading(false); return; }

    (async () => {
      setLoading(true);

      // Update commission rate for selected manager
      const mgr = managers.find((m) => m.id === effectiveManagerId);
      if (mgr) setCommissionRate(mgr.commission_rate_percentage || 0);

      // Fetch companies assigned to this manager. Non-admin users are forced to their own user.id via effectiveManagerId.
      const { data: comps } = await supabase
        .from("companies")
        .select("id, business_name, account_manager_id")
        .eq("account_manager_id", effectiveManagerId);
      const companyList: Company[] = await Promise.all((comps || []).map(async (company) => {
        try {
          return { ...company, wallet_balance: await getWalletBalance(company.id) };
        } catch {
          // PF-6B is fail-closed: an unavailable Core balance is not ₹0.
          return { ...company, wallet_balance: null };
        }
      }));
      setCompanies(companyList);

      const companyIds = companyList.map((c) => c.id);
      if (companyIds.length > 0) {
        // Fetch orders for these companies (last 60 days for graph + calculations)
        const since = subDays(new Date(), 60).toISOString();
        const { data: ords } = await supabase
          .from("orders")
          .select("id, company_id, status, sales_order_value, created_at, payment_status")
          .in("company_id", companyIds)
          .gte("created_at", since);
        setOrders(ords || []);

        // Fetch returns for these companies' orders
        const orderIds = (ords || []).map((o) => o.id);
        if (orderIds.length > 0) {
          const { data: rets } = await supabase
            .from("order_returns")
            .select("order_id, quantity_returned, loss_amount, original_value, final_credit_value, product_id")
            .in("order_id", orderIds);
          setReturns(rets || []);
        } else {
          setReturns([]);
        }
      } else {
        setOrders([]);
        setReturns([]);
      }

      // Fetch inward_material_advice for this sales exec (settled ones for liability)
      const { data: advices } = await supabase
        .from("inward_material_advice")
        .select("id, expected_value, settlement_value, fault_attribution, status")
        .eq("sales_exec_id", effectiveManagerId)
        .eq("status", "settled");
      setInwardAdvices(advices || []);

      // Fetch products for return modal
      const { data: prods } = await supabase.from("products").select("id, name").eq("is_active", true).limit(500);
      setProducts(prods || []);

      setLoading(false);
    })();
  }, [user, normalizedRole, canUseHub, effectiveManagerId, managers]);

  // ─── Calculations ───
  const last30 = useMemo(() => {
    const cutoff = subDays(new Date(), 30).getTime();
    return orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= cutoff);
  }, [orders]);

  // Growth graph data (daily sales value)
  const graphData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      days[d] = 0;
    }
    last30.forEach((o) => {
      if (o.created_at) {
        const d = format(new Date(o.created_at), "MMM dd");
        if (days[d] !== undefined) days[d] += (o.sales_order_value || 0);
      }
    });
    return Object.entries(days).map(([date, value]) => ({ date, value }));
  }, [last30]);

  const deliveredValue = useMemo(
    () => orders.filter((o) => o.status === "delivered").reduce((s, o) => s + (o.sales_order_value || 0), 0),
    [orders]
  );
  const commission = deliveredValue * (commissionRate / 100);

  const unpaidValue = useMemo(
    () => orders.filter((o) => o.payment_status === "unpaid" || o.payment_status === "partial").reduce((s, o) => s + (o.sales_order_value || 0), 0),
    [orders]
  );
  // Return liability from inward_material_advice — ONLY 'Sales Error' faults count
  const returnLiabilityValue = useMemo(() => {
    return inwardAdvices.reduce((s, adv) => {
      // Only Sales Error faults are the executive's liability
      if (adv.fault_attribution !== "Sales Error") return s;
      const loss = (adv.expected_value || 0) - (adv.settlement_value || 0);
      return s + (loss > 0 ? loss : 0);
    }, 0);
  }, [inwardAdvices]);
  const liability = unpaidValue + returnLiabilityValue;

  // Last order date per company
  const lastOrderMap = useMemo(() => {
    const map: Record<string, string> = {};
    orders.forEach((o) => {
      if (o.company_id && o.created_at) {
        if (!map[o.company_id] || o.created_at > map[o.company_id]) {
          map[o.company_id] = o.created_at;
        }
      }
    });
    return map;
  }, [orders]);

  // ─── Return Logger ───
  const handleLogReturn = async () => {
    if (!returnOrderId || !returnProductId || !returnQty) {
      toast.error("All fields are required.");
      return;
    }

    const companyIds = companies.map((c) => c.id);
    if (companyIds.length === 0) {
      toast.error("No assigned clients available for this return.");
      return;
    }

    setReturnSaving(true);

    const { data: allowedOrder, error: allowedOrderError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", returnOrderId)
      .in("company_id", companyIds)
      .maybeSingle();

    if (allowedOrderError || !allowedOrder) {
      toast.error("This order is not assigned to your visible client scope.");
      setReturnSaving(false);
      return;
    }

    const { error } = await supabase.from("order_returns").insert({
      order_id: returnOrderId,
      product_id: returnProductId,
      quantity_returned: parseInt(returnQty),
      reason: returnReason || null,
      logged_by: user?.id || null,
      status: "pending",
    });
    setReturnSaving(false);
    if (error) {
      toast.error("Failed to log return: " + error.message);
    } else {
      toast.success("Return logged successfully.");
      setShowReturnModal(false);
      setReturnOrderId("");
      setReturnProductId("");
      setReturnQty("");
      setReturnReason("");
    }
  };

  if (!user) return null;

  if (!loading && normalizedRole && !canUseHub) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales Performance Hub</h1>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">You are not authorized to view sales performance data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales Performance Hub</h1>
          <p className="text-muted-foreground mt-1">Executive intelligence & commission tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Select value={selectedManagerId || ""} onValueChange={(v) => setSelectedManagerId(v)}>
              <SelectTrigger className="w-64 bg-card border-border">
                <SelectValue placeholder="Select Sales Executive" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.name || m.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setShowAdviceModal(true)} className="gap-2" disabled={!canUseHub || !effectiveManagerId}>
            <ClipboardList size={16} /> Pre-Entry: Advise Return
          </Button>
          <Button variant="outline" onClick={() => setShowReturnModal(true)} className="gap-2" disabled={!canUseHub || !effectiveManagerId}>
            <RotateCcw size={16} /> Log Return
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !effectiveManagerId ? (
        <div className="text-center py-20 text-muted-foreground text-lg">Select a Sales Executive to view performance.</div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiCard
              icon={<TrendingUp size={24} />}
              label="Commission Earned"
              value={`₹${commission.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              sub={`${commissionRate}% of ₹${deliveredValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} delivered`}
              accent="text-emerald-600"
              bg="bg-emerald-50"
            />
            <KpiCard
              icon={<AlertTriangle size={24} />}
              label="Liability Exposure"
              value={`₹${liability.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              sub={`Order Dues: ₹${unpaidValue.toLocaleString("en-IN")} | Returns Loss: ₹${returnLiabilityValue.toLocaleString("en-IN")}`}
              accent="text-red-600"
              bg="bg-red-50"
            />
            <KpiCard
              icon={<Users size={24} />}
              label="Active Clients"
              value={String(companies.length)}
              sub="Assigned companies"
              accent="text-[#C4A052]"
              bg="bg-[#C4A052]/10"
            />
          </div>

          {/* GROWTH GRAPH */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-[#C4A052]" /> Sales Value — Last 30 Days
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                    formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Sales"]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#C4A052" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* CLIENT WATCHLIST WITH TABS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Shield size={20} className="text-[#C4A052]" /> Client Watchlist
            </h2>
            <Tabs defaultValue="watchlist">
              <TabsList>
                <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
                <TabsTrigger value="interactions">Interactions</TabsTrigger>
              </TabsList>
              <TabsContent value="watchlist">
                {companies.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No assigned clients.</p>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Last Order</TableHead>
                          <TableHead className="text-right">Wallet Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companies.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-semibold">{c.business_name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {lastOrderMap[c.id] ? format(new Date(lastOrderMap[c.id]), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {c.wallet_balance == null ? "Unavailable" : `₹${c.wallet_balance.toLocaleString("en-IN")}`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="interactions">
                <ClientInteractionsTab companies={companies} userId={user?.id} />
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* ADMIN INTELLIGENCE PANEL */}
          {isAdmin && <SalesIntelligencePanel />}
        </>
      )}

      {/* RETURN LOGGER MODAL */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw size={20} className="text-red-500" /> Log Product Return
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Order ID</label>
              <Input
                placeholder="Paste order UUID"
                value={returnOrderId}
                onChange={(e) => setReturnOrderId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Product</label>
              <Select value={returnProductId} onValueChange={setReturnProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Quantity Returned</label>
              <Input type="number" min="1" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Reason (optional)</label>
              <Input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="e.g. Damaged in transit" />
            </div>
            <Button onClick={handleLogReturn} disabled={returnSaving} className="w-full gap-2">
              {returnSaving ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
              Submit Return
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* INWARD ADVICE MODAL */}
      <InwardAdviceModal
        open={showAdviceModal}
        onOpenChange={setShowAdviceModal}
        companies={companies}
        products={products}
        userId={effectiveManagerId ?? user?.id}
      />
    </div>
  );
};

/* ── KPI Card ── */
function KpiCard({ icon, label, value, sub, accent, bg }: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent: string; bg: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${bg} rounded-2xl p-6 border border-border`}
    >
      <div className={`${accent} mb-3`}>{icon}</div>
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-black mt-1 ${accent}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-2">{sub}</p>
    </motion.div>
  );
}

export default SalesPerformanceHub;
