import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Clock,
  CheckCheck,
  Users,
  UserCheck,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Search,
  CreditCard,
  Percent,
  Edit,
  ShieldCheck,
  ShieldAlert,
  Building,
  X,
} from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

/* ─── types ─── */
interface Application {
  id: string;
  business_name: string;
  trade_name: string | null;
  business_type: string | null;
  contact_person: string | null;
  contact_email: string | null;
  mobile_number: string | null;
  gst_number: string | null;
  expected_volume: string | null;
  city: string | null;
  state: string | null;
  registered_address: string | null;
  status: string;
  created_at: string | null;
  user_id: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  assigned_price_tier: string | null;
}

interface PricingSlab {
  id: string;
  slab_name: string;
}
interface PortalInvite {
  id: string;
  application_id: string | null;
  company_id: string | null;
  invite_email: string;
  status: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
  notes: string | null;
}
interface Company {
  id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  status: string;
  credit_limit: number;
  discount_percentage: number;
  created_at: string;
}

/* ─── dummy data ─── */
const DUMMY_APPS: Application[] = [
  {
    id: "d1",
    business_name: "Royal Sweets Emporium",
    trade_name: "Royal Sweets",
    business_type: "Distributor",
    contact_person: "Rajesh Sharma",
    contact_email: "rajesh@royalsweets.in",
    mobile_number: "+91 98765 43210",
    gst_number: "27AABCU9603R1ZM",
    expected_volume: "500-1000 kg",
    city: "Mumbai",
    state: "Maharashtra",
    registered_address: "42, Mithai Lane, Dadar West, Mumbai 400028",
    status: "pending",
    created_at: "2026-03-15T10:30:00Z",
    user_id: null,
    admin_notes: null,
    rejection_reason: null,
    assigned_price_tier: null,
  },
  {
    id: "d2",
    business_name: "Bombay Bakery House",
    trade_name: "BBH",
    business_type: "Retailer",
    contact_person: "Priya Mehta",
    contact_email: "priya@bbh.co.in",
    mobile_number: "+91 87654 32109",
    gst_number: "27AABCU9604R1ZN",
    expected_volume: "100-500 kg",
    city: "Pune",
    state: "Maharashtra",
    registered_address: "15, Baker Street, Koregaon Park, Pune 411001",
    status: "pending",
    created_at: "2026-03-14T08:15:00Z",
    user_id: null,
    admin_notes: null,
    rejection_reason: null,
    assigned_price_tier: null,
  },
  {
    id: "d3",
    business_name: "Delhi Dry Fruits Co.",
    trade_name: "DDFC",
    business_type: "Wholesaler",
    contact_person: "Amit Gupta",
    contact_email: "amit@ddfc.in",
    mobile_number: "+91 99876 54321",
    gst_number: "07AABCU9605R1ZO",
    expected_volume: "1000-5000 kg",
    city: "New Delhi",
    state: "Delhi",
    registered_address: "78, Chandni Chowk, Old Delhi 110006",
    status: "approved",
    created_at: "2026-03-10T14:00:00Z",
    user_id: null,
    admin_notes: "Premium client",
    rejection_reason: null,
    assigned_price_tier: "Slab A",
  },
];

const DUMMY_SLABS: PricingSlab[] = [
  { id: "s1", slab_name: "Slab A" },
  { id: "s2", slab_name: "Slab B" },
  { id: "s3", slab_name: "Slab C" },
];
const STATUS_TABS = ["pending", "approved", "rejected", "directory"] as const;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const statusBadgeClass = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

/* ─── Component ─── */
const AdminClients = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string>("pending");

  // App Review State
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priceTier, setPriceTier] = useState<Record<string, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [pricingSlabs, setPricingSlabs] = useState<PricingSlab[]>(DUMMY_SLABS);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [invites, setInvites] = useState<PortalInvite[]>([]);

  // Directory State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);

  useEffect(() => {
    supabase
      .from("pricing_slabs")
      .select("id, slab_name")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data && data.length > 0) setPricingSlabs(data as PricingSlab[]);
      });
    supabase
      .from("portal_access_invites")
      .select("*")
      .then(({ data }) => {
        setInvites((data as PortalInvite[]) ?? []);
      });
  }, []);

  const fetchApps = async (status: string) => {
    setLoading(true);
    if (status === "directory") {
      const { data } = await (supabase as any).from("companies").select("*").order("created_at", { ascending: false });
      setActiveCompanies((data as Company[]) ?? []);
    } else {
      const { data } = await supabase
        .from("b2b_applications")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });
      const dbApps = (data as Application[]) ?? [];
      const dummyForTab = DUMMY_APPS.filter((d) => d.status === status);
      setApps(dbApps.length > 0 ? dbApps : dummyForTab);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApps(tab);
  }, [tab]);

  const pendingCount = tab === "pending" ? apps.length : DUMMY_APPS.filter((d) => d.status === "pending").length;
  const approvedCount = tab === "approved" ? apps.length : DUMMY_APPS.filter((d) => d.status === "approved").length;

  /* ─── App Pipeline Logic ─── */
  const handleApprove = async (app: Application) => {
    if (app.id.startsWith("d")) {
      toast.success(`${app.business_name} approved (demo)`);
      setSheetOpen(false);
      return;
    }
    setActionLoading(app.id);

    const { error } = await supabase
      .from("b2b_applications")
      .update({
        status: "approved",
        admin_notes: notes[app.id] || null,
        assigned_price_tier: priceTier[app.id] || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", app.id);

    if (error) {
      toast.error("Failed to approve");
      setActionLoading(null);
      return;
    }

    let companyId: string | null = null;
    if (app.gst_number) {
      const { data } = await supabase.from("companies").select("id").eq("gst_number", app.gst_number).maybeSingle();
      if (data) companyId = data.id;
    }
    if (!companyId) {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("business_name", app.business_name)
        .maybeSingle();
      if (data) companyId = data.id;
    }
    if (!companyId) {
      const { data } = await supabase
        .from("companies")
        .insert({ business_name: app.business_name, gst_number: app.gst_number })
        .select()
        .single();
      if (data) companyId = data.id;
    }

    if (app.user_id && companyId) {
      await supabase.from("users").update({ role: "buyer", company_id: companyId }).eq("id", app.user_id);
    }

    toast.success(`${app.business_name} approved`);
    setSheetOpen(false);
    fetchApps(tab);
    setActionLoading(null);
  };

  const handleReject = async (app: Application) => {
    if (app.id.startsWith("d")) {
      toast.success(`${app.business_name} rejected (demo)`);
      setSheetOpen(false);
      return;
    }
    setActionLoading(app.id);
    const { error } = await supabase
      .from("b2b_applications")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason[app.id] || null,
        admin_notes: notes[app.id] || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", app.id);

    if (!error) {
      toast.success(`${app.business_name} rejected`);
      setSheetOpen(false);
      fetchApps(tab);
    }
    setActionLoading(null);
  };

  const getInviteForApp = (appId: string) =>
    invites
      .filter((i) => i.application_id === appId)
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0] ?? null;

  const handleSendInvite = async (app: Application) => {
    if (!app.contact_email) {
      toast.error("No contact email");
      return;
    }
    if (app.id.startsWith("d")) {
      toast.success(`Portal invite sent to ${app.contact_email} (demo)`);
      return;
    }
    setInviteSending(app.id);

    const { error } = await supabase.from("portal_access_invites").insert({
      application_id: app.id,
      invite_email: app.contact_email,
      notes: `Portal access invite for ${app.business_name}`,
      status: "pending",
      sent_at: new Date().toISOString(),
    });

    if (!error) {
      toast.success(`Portal invite sent to ${app.contact_email}`);
      const { data } = await supabase.from("portal_access_invites").select("*");
      setInvites((data as PortalInvite[]) ?? []);
    }
    setInviteSending(null);
  };

  /* ─── Directory Logic ─── */
  const openCompanyEditModal = (company: Company) => {
    setSelectedCompany(company);
    setEditCreditLimit(company.credit_limit || 0);
    setEditDiscount(company.discount_percentage || 0);
  };

  const executeUpdateCompany = async () => {
    if (!selectedCompany) return;
    setIsUpdatingCompany(true);
    const { error } = await (supabase as any)
      .from("companies")
      .update({
        credit_limit: editCreditLimit,
        discount_percentage: editDiscount,
      })
      .eq("id", selectedCompany.id);

    if (!error) {
      toast.success("Client profile updated successfully!");
      setSelectedCompany(null);
      fetchApps("directory");
    } else {
      toast.error("Failed to update client.");
    }
    setIsUpdatingCompany(false);
  };

  const filteredCompanies = activeCompanies.filter((c) =>
    (c.business_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
  );

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      <TopNavBar />

      <main className="pt-24 px-4 sm:px-6 max-w-7xl mx-auto space-y-6 pb-20">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <h1 className="text-display-h2 text-foreground flex items-center gap-3">
            <Users className="text-[#B8860B]" size={32} /> Client Governance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review applications and manage active B2B directories.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-2xl font-semibold font-ui text-foreground">{pendingCount}</p>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Pending Review</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
              <UserCheck size={20} />
            </div>
            <div>
              <p className="text-2xl font-semibold font-ui text-foreground">{approvedCount}</p>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Recently Approved</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#B8860B]/10 text-[#B8860B]">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-2xl font-semibold font-ui text-foreground">{activeCompanies.length || 1}</p>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                Total Active Directory
              </p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
        >
          <Tabs value={tab} onValueChange={setTab}>
            <div className="px-5 pt-4 pb-0">
              <TabsList className="bg-muted/40 p-1">
                {STATUS_TABS.map((s) => (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="capitalize text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm px-5"
                  >
                    {s === "directory" ? "Active Directory" : s}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {STATUS_TABS.map((s) => (
              <TabsContent key={s} value={s} className="mt-0">
                {loading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 size={22} className="animate-spin text-[#B8860B]" />
                  </div>
                ) : s === "directory" ? (
                  /* DIRECTORY TAB */
                  <div className="p-5 bg-slate-50 min-h-[400px]">
                    <div className="mb-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 max-w-sm">
                      <div className="bg-slate-50 p-2 rounded-lg text-slate-400">
                        <Search size={16} />
                      </div>
                      <input
                        type="text"
                        placeholder="Search active partners..."
                        className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-slate-900"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCompanies.map((client) => (
                        <div
                          key={client.id}
                          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                                  <Building2 size={18} />
                                </div>
                                <div>
                                  <h3 className="font-black text-lg text-slate-900 leading-tight line-clamp-1">
                                    {client.business_name}
                                  </h3>
                                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1 mt-1">
                                    <ShieldCheck size={10} /> Active
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                            <div className="flex gap-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Credit Limit
                                </p>
                                <p className="text-sm font-black text-slate-900">
                                  ₹{(client.credit_limit || 0).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Discount
                                </p>
                                <p className="text-sm font-black text-emerald-600">
                                  {client.discount_percentage || 0}%
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => openCompanyEditModal(client)}
                              className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-[#B8860B] hover:text-white transition-colors flex items-center justify-center"
                            >
                              <Edit size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : apps.length === 0 ? (
                  /* EMPTY PIPELINE */
                  <div className="py-16 text-center">
                    <Users size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No {s} applications</p>
                  </div>
                ) : (
                  /* APPLICATION PIPELINE TABLE */
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Business Name
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Contact Person
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {apps.map((a, i) => (
                            <motion.tr
                              key={a.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => {
                                setSelectedApp(a);
                                setSheetOpen(true);
                              }}
                              className="border-b border-border cursor-pointer hover:bg-muted/20"
                            >
                              <TableCell className="py-4">
                                <div>
                                  <p className="font-semibold text-foreground text-sm group-hover:text-primary">
                                    {a.business_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {a.city}, {a.state}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <p className="text-sm text-foreground">{a.contact_person || "—"}</p>
                                <p className="text-xs text-muted-foreground">{a.contact_email}</p>
                              </TableCell>
                              <TableCell className="py-4 text-right">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-semibold capitalize ${statusBadgeClass(a.status)}`}
                                >
                                  {a.status}
                                </Badge>
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      </main>

      {/* ─── Application Review Sheet ─── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l border-border bg-background p-0">
          {selectedApp && (
            <div className="flex flex-col h-full">
              <div className="px-6 pt-6 pb-4 border-b border-border bg-muted/20">
                <SheetHeader className="space-y-1">
                  <SheetTitle className="text-lg font-display text-foreground">{selectedApp.business_name}</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    {selectedApp.trade_name ? `Trade: ${selectedApp.trade_name} · ` : ""}
                    {selectedApp.business_type || "Business"}
                  </SheetDescription>
                </SheetHeader>
                <Badge
                  variant="outline"
                  className={`mt-3 text-[11px] font-semibold capitalize ${statusBadgeClass(selectedApp.status)}`}
                >
                  {selectedApp.status}
                </Badge>
              </div>
              <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Contact Details
                  </h4>
                  <div className="space-y-2.5">
                    <DetailRow icon={Building2} label="Contact Person" value={selectedApp.contact_person} />
                    <DetailRow icon={Mail} label="Email" value={selectedApp.contact_email} />
                    <DetailRow icon={Phone} label="Mobile" value={selectedApp.mobile_number} />
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Business Information
                  </h4>
                  <div className="space-y-2.5">
                    <DetailRow icon={FileText} label="GSTIN" value={selectedApp.gst_number} />
                    <DetailRow
                      icon={MapPin}
                      label="Address"
                      value={selectedApp.registered_address || `${selectedApp.city}, ${selectedApp.state}`}
                    />
                    <DetailRow icon={Users} label="Expected Volume" value={selectedApp.expected_volume} />
                  </div>
                </div>
                {selectedApp.status === "approved" && (
                  <>
                    <Separator />
                    <PortalInviteSection
                      app={selectedApp}
                      invite={getInviteForApp(selectedApp.id)}
                      onSendInvite={handleSendInvite}
                      sending={inviteSending === selectedApp.id}
                    />
                  </>
                )}
              </div>
              {selectedApp.status === "pending" && (
                <div className="border-t border-border px-6 py-5 bg-muted/10 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Pricing Slab
                    </label>
                    <Select
                      value={priceTier[selectedApp.id] || ""}
                      onValueChange={(v) => setPriceTier({ ...priceTier, [selectedApp.id]: v })}
                    >
                      <SelectTrigger className="mt-1.5 rounded-lg bg-card">
                        <SelectValue placeholder="Select pricing slab…" />
                      </SelectTrigger>
                      <SelectContent>
                        {pricingSlabs.map((s) => (
                          <SelectItem key={s.id} value={s.slab_name}>
                            {s.slab_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Button
                      onClick={() => handleApprove(selectedApp)}
                      disabled={actionLoading === selectedApp.id}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                    >
                      {actionLoading === selectedApp.id ? (
                        <Loader2 size={14} className="animate-spin mr-1.5" />
                      ) : (
                        <CheckCircle2 size={14} className="mr-1.5" />
                      )}
                      Approve & Assign
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleReject(selectedApp)}
                      disabled={actionLoading === selectedApp.id}
                      className="text-destructive hover:bg-destructive/10 font-semibold rounded-lg"
                    >
                      <XCircle size={14} className="mr-1.5" /> Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Directory Edit Modal ─── */}
      <Dialog
        open={!!selectedCompany}
        onOpenChange={(open) => {
          if (!open) setSelectedCompany(null);
        }}
      >
        <DialogContent className="max-w-md bg-white border-slate-200 rounded-3xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Building className="text-[#B8860B]" /> Edit B2B Credit Profile
            </DialogTitle>
            <p className="text-sm font-bold text-slate-500 mt-1">{selectedCompany?.business_name}</p>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <CreditCard size={12} /> Credit Limit (₹)
              </Label>
              <Input
                type="number"
                value={editCreditLimit}
                onChange={(e) => setEditCreditLimit(Number(e.target.value))}
                className="bg-slate-50 font-black text-lg h-12 rounded-xl focus:border-[#B8860B]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Percent size={12} /> Base Discount (%)
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editDiscount}
                onChange={(e) => setEditDiscount(Number(e.target.value))}
                className="bg-slate-50 font-black text-lg h-12 rounded-xl focus:border-[#B8860B]"
              />
            </div>
            <button
              onClick={executeUpdateCompany}
              disabled={isUpdatingCompany}
              className="w-full mt-4 py-4 rounded-xl font-black text-sm uppercase tracking-widest bg-[#B8860B] text-white hover:bg-[#9A7009] flex items-center justify-center gap-2"
            >
              {isUpdatingCompany ? <Loader2 size={18} className="animate-spin" /> : "Save Profile"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon size={14} className="text-muted-foreground" />
    </div>
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground mt-0.5">{value || "—"}</p>
    </div>
  </div>
);
const PortalInviteSection = ({ app, invite, onSendInvite, sending }: any) => (
  <div className="space-y-3">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portal Access</h4>
    {invite ? (
      <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {invite.status === "accepted" ? (
            <CheckCheck size={14} className="text-emerald-600" />
          ) : (
            <Clock size={14} className="text-amber-600" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {invite.status === "accepted" ? "Portal Active" : "Invite Pending"}
          </span>
        </div>
      </div>
    ) : (
      <div className="bg-red-50 rounded-lg p-3">
        <p className="text-sm font-semibold text-red-700">Portal not activated</p>
      </div>
    )}
    <Button
      variant="outline"
      size="sm"
      onClick={() => onSendInvite(app)}
      disabled={sending || invite?.status === "pending"}
      className="border-primary/30 text-primary hover:bg-primary/5"
    >
      {sending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Send size={14} className="mr-1.5" />}
      {invite?.status === "pending" ? "Invite Already Sent" : "Send Portal Access Invite"}
    </Button>
  </div>
);

export default AdminClients;
