import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, CreditCard, ShoppingCart, Search, Building2, Wallet, IndianRupee } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CreditRequestModal from "@/components/CreditRequestModal";

const SalesDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; business_name: string } | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const fetchRole = async () => {
      const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      setRole(data?.role ?? null);
      setRoleLoading(false);
    };
    fetchRole();
  }, [user, authLoading]);

  useEffect(() => {
    if (roleLoading || !role) return;
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, business_name, gst_number, status, wallet_balance, credit_limit, current_balance, allow_credit, created_at")
        .eq("status", "approved")
        .eq("account_manager_id", user!.id)
        .order("business_name");
      setCompanies(data || []);
      setDataLoading(false);
    };
    fetchCompanies();
  }, [role, roleLoading]);

  if (authLoading || roleLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  if (!role || !["sales_executive", "super_admin", "admin"].includes(role)) {
    return <Navigate to="/login" replace />;
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
          <Badge variant="outline" className="text-xs">{role?.replace("_", " ").toUpperCase()}</Badge>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-2.5 rounded-lg bg-primary/10"><Building2 size={20} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Active Clients</p>
                <p className="text-2xl font-semibold text-foreground">{companies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-2.5 rounded-lg bg-primary/10"><Wallet size={20} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Wallet Balance</p>
                <p className="text-2xl font-semibold text-foreground">₹{totalWallet.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-2.5 rounded-lg bg-primary/10"><IndianRupee size={20} className="text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Credit Limits</p>
                <p className="text-2xl font-semibold text-foreground">₹{totalCredit.toLocaleString()}</p>
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
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5"
                            onClick={() => {
                              localStorage.setItem("impersonated_client", JSON.stringify({ company_id: c.id, business_name: c.business_name }));
                              navigate("/");
                            }}>
                            <ShoppingCart size={13} /> Place Order
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
    </div>
  );
};

export default SalesDashboard;
