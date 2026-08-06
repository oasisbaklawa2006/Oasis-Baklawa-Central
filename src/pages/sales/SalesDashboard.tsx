import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CreditCard, Search, Building2, Wallet, IndianRupee, Phone, MessageSquare, TrendingUp, Target, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CreditRequestModal from "@/components/CreditRequestModal";
import { format, startOfMonth } from "date-fns";

interface SalesCompany {
  id: string;
  business_name: string;
  gst_number: string | null;
  status: string;
  wallet_balance: number | null;
  credit_limit: number | null;
  current_balance: number | null;
  allow_credit: boolean | null;
  created_at: string;
}

interface SalesOrder {
  id: string;
  company_id: string;
  sales_order_value: number | null;
  status: string;
  created_at: string;
}

interface SalesInteraction {
  id: string;
  company_id: string;
}

const SalesDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<SalesCompany[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; business_name: string } | null>(null);

  // Live revenue data
  const [monthOrders, setMonthOrders] = useState<SalesOrder[]>([]);
  const [interactions, setInteractions] = useState<SalesInteraction[]>([]);
  const [overdueTasks, setOverdueTasks] = useState(0);

  // Log interaction modal
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logType, setLogType] = useState<string>("call");
  const [logCompany, setLogCompany] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logOutcome, setLogOutcome] = useState("");
  const [logFollowUp, setLogFollowUp] = useState("");
  const [logSaving, setLogSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const fetchAll = async () => {
      setDataLoading(true);
      // Fetch assigned companies
      const { data: comps, error } = await supabase
        .from("companies")
        .select("id, business_name, gst_number, status, wallet_balance, credit_limit, current_balance, allow_credit, created_at")
        .eq("status", "approved")
        .eq("account_manager_id", user.id)
        .order("business_name");
      if (error) {
        toast({ title: "Connection Error", description: "Could not load client data.", variant: "destructive" });
      }
      const companyList = comps || [];
      setCompanies(companyList);

      const companyIds = companyList.map((c) => c.id);
      if (companyIds.length > 0) {
        const monthStart = startOfMonth(new Date()).toISOString();

        // Fetch this month's orders for assigned clients
        const { data: orders } = await supabase
          .from("orders")
          .select("id, company_id, sales_order_value, status, created_at")
          .in("company_id", companyIds)
          .gte("created_at", monthStart)
          .not("status", "in", '("draft","cart","cancelled")');
        setMonthOrders(orders || []);

        // Fetch interactions for CRM score
        const { data: ints } = await supabase
          .from("client_interactions")
          .select("id, company_id")
          .in("company_id", companyIds)
          .eq("executive_id", user.id);
        setInteractions(ints || []);

        // Fetch overdue tasks count
        const today = format(new Date(), "yyyy-MM-dd");
        const { count } = await supabase
          .from("crm_tasks")
          .select("id", { count: "exact", head: true })
          .eq("sales_exec_id", user.id)
          .eq("status", "pending")
          .lt("due_date", today);
        setOverdueTasks(count || 0);
      }

      setDataLoading(false);
    };
    fetchAll();
  }, [user, authLoading]);

  // Derived KPIs
  const monthRevenue = useMemo(() =>
    monthOrders.reduce((s, o) => s + (o.sales_order_value || 0), 0), [monthOrders]);
  const monthOrderCount = monthOrders.length;

  // CRM Score: % of assigned clients that have at least one interaction logged
  const crmScore = useMemo(() => {
    if (companies.length === 0) return 0;
    const clientsWithInteraction = new Set(interactions.map(i => i.company_id));
    return Math.round((clientsWithInteraction.size / companies.length) * 100);
  }, [companies, interactions]);

  const handleLogInteraction = async () => {
    if (!logCompany) {
      toast({ title: "Required", description: "Select a client.", variant: "destructive" });
      return;
    }
    if (!logNotes.trim()) {
      toast({ title: "Required", description: "Notes cannot be empty.", variant: "destructive" });
      return;
    }
    setLogSaving(true);
    const { error } = await supabase.from("client_interactions").insert({
      company_id: logCompany,
      executive_id: user?.id || null,
      interaction_type: logType,
      notes: logNotes.trim(),
      outcome: logOutcome.trim() || null,
      follow_up_date: logFollowUp || null,
    });
    setLogSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✓ Activity Logged", description: `${logType} logged for client.` });
      setLogModalOpen(false);
      setLogNotes("");
      setLogOutcome("");
      setLogFollowUp("");
      setLogCompany("");
      // Refresh interactions count
      if (user) {
        const companyIds = companies.map((c) => c.id);
        const { data: ints } = await supabase
          .from("client_interactions")
          .select("id, company_id")
          .in("company_id", companyIds)
          .eq("executive_id", user.id);
        setInteractions(ints || []);
      }
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  const filtered = companies.filter(c =>
    c.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.gst_number?.toLowerCase().includes(search.toLowerCase())
  );

  const totalWallet = companies.reduce((s, c) => s + (c.wallet_balance || 0), 0);
  const totalCredit = companies.reduce((s, c) => s + (c.credit_limit || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sales Executive Console</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Client management & credit operations</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setLogType("call"); setLogModalOpen(true); }}>
              <Phone size={13} /> Log Call
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setLogType("whatsapp"); setLogModalOpen(true); }}>
              <MessageSquare size={13} /> Log Message
            </Button>
            <Badge variant="outline" className="text-xs">SALES EXECUTIVE</Badge>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-primary/10"><Building2 size={18} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Clients</p>
                <p className="text-xl font-semibold text-foreground">{companies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-primary/10"><TrendingUp size={18} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Orders (Month)</p>
                <p className="text-xl font-semibold text-foreground">{monthOrderCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-primary/10"><IndianRupee size={18} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue (Month)</p>
                <p className="text-xl font-semibold text-foreground">₹{monthRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-primary/10"><Wallet size={18} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Wallet Pool</p>
                <p className="text-xl font-semibold text-foreground">₹{totalWallet.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-primary/10"><Target size={18} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">CRM Score</p>
                <p className="text-xl font-semibold text-foreground">{crmScore}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`p-2 rounded-lg ${overdueTasks > 0 ? "bg-destructive/10" : "bg-primary/10"}`}>
                <AlertCircle size={18} className={overdueTasks > 0 ? "text-destructive" : "text-primary"} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overdue Tasks</p>
                <p className={`text-xl font-semibold ${overdueTasks > 0 ? "text-destructive" : "text-foreground"}`}>{overdueTasks}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Roster */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Client Roster</CardTitle>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search clients…" className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dataLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No approved companies found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead className="text-right">Wallet</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.business_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{c.gst_number || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">₹{(c.wallet_balance || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">₹{(c.credit_limit || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">₹{(c.current_balance || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                            onClick={() => { setSelectedCompany({ id: c.id, business_name: c.business_name }); setCreditModalOpen(true); }}>
                            <CreditCard size={13} /> Request Credit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreditRequestModal open={creditModalOpen} onClose={() => setCreditModalOpen(false)} company={selectedCompany} />

      {/* Log Interaction Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {logType === "call" ? <Phone size={18} className="text-primary" /> : <MessageSquare size={18} className="text-primary" />}
              Log {logType === "call" ? "Call" : logType === "whatsapp" ? "WhatsApp Message" : "Visit"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Client *</label>
              <Select value={logCompany} onValueChange={setLogCompany}>
                <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Notes *</label>
              <Textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="What was discussed? Key points only." />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Outcome</label>
              <Input value={logOutcome} onChange={(e) => setLogOutcome(e.target.value)} placeholder="e.g. Order confirmed, Will revert tomorrow" />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1 block">Follow-up Date</label>
              <Input type="date" value={logFollowUp} onChange={(e) => setLogFollowUp(e.target.value)} />
            </div>
            <Button onClick={handleLogInteraction} disabled={logSaving} className="w-full gap-2">
              {logSaving ? <Loader2 className="animate-spin" size={16} /> : logType === "call" ? <Phone size={16} /> : <MessageSquare size={16} />}
              Log Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesDashboard;
