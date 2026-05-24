import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyEvent } from "@/utils/notifyEvent";
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
  Building,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  credit_limit?: number | null;
  discount_percentage?: number | null;
  created_at?: string | null;
}

const STATUS_TABS = ["pending", "approved", "rejected", "directory"] as const;

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
  const [stableCounts, setStableCounts] = useState({ pending: 0, approved: 0, active: 0 });

  // App Review State
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priceTier, setPriceTier] = useState<Record<string, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [pricingSlabs, setPricingSlabs] = useState<PricingSlab[]>([]);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [invites, setInvites] = useState<PortalInvite[]>([]);

  // Request Info state
  const [requestInfoNote, setRequestInfoNote] = useState<Record<string, string>>({});
  const [requestingInfo, setRequestingInfo] = useState<string | null>(null);

  // Account Manager assignment state
  const [accountManager, setAccountManager] = useState<Record<string, string>>({});
  const [managers, setManagers] = useState<{ id: string; label: string }[]>([]);

  // Directory State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("pricing_slabs")
      .select("id, slab_name")
      .eq("is_active", true)
      .then(({ data }) => {
        setPricingSlabs((data as unknown as PricingSlab[]) ?? []);
      });
    supabase
      .from("portal_access_invites")
      .select("*")
      .then(({ data }) => {
        setInvites((data as unknown as PortalInvite[]) ?? []);
      });
    supabase
      .from("users")
      .select("id, full_name, email, role, is_sales_executive")
      .or("role.eq.sales_executive,role.eq.admin,role.eq.super_admin,is_sales_executive.eq.true")
      .eq("is_active", true)
      .then(({ data }) => {
        const mgrs = ((data as { id: string; full_name: string | null; email: string | null }[]) ?? []).map((u) => ({
          id: u.id,
          label: u.full_name || u.email || u.id,
        }));
        setManagers(mgrs);
      });

    // Stable counter query — single source of truth with Error Boundary
    const fetchStableCounts = async () => {
      try {
        const [pendingRes, approvedRes, activeRes] = await Promise.all([
          supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
          supabase.from("companies").select("id", { count: "exact", head: true }),
        ]);
        setStableCounts({
          pending: pendingRes.count ?? 0,
          approved: approvedRes.count ?? 0,
          active: activeRes.count ?? 0,
        });
      } catch (err) {
        console.error("Failed to fetch stable counts:", err);
      }
    };
    fetchStableCounts();
  }, []);

  const fetchApps = async (status: string) => {
    setLoading(true);
    setListError(null);
    try {
      if (status === "directory") {
        const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        setActiveCompanies((data as unknown as Company[]) ?? []);
      } else {
        const { data, error } = await supabase
          .from("b2b_applications")
          .select("*")
          .eq("status", status)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setApps((data as unknown as Application[]) ?? []);
      }
    } catch (err: any) {
      console.error("Failed to fetch applications:", err);
      const msg = err?.message || "Failed to load records.";
      setListError(msg);
      toast.error("Failed to load records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps(tab);
  }, [tab]);

  const pendingCount = stableCounts.pending;
  const approvedCount = stableCounts.approved;

  /* ─── App Pipeline Logic ─── */
  const handleApprove = async (app: Application) => {
    // Mandatory slab gate — approval cannot proceed without a pricing slab assigned.
    if (!priceTier[app.id]) {
      toast.error("Pricing slab is required before approval. Please select a slab.");
      return;
    }

    setActionLoading(app.id);

    try {
      let companyId: string | null = null;
      const approvedRole = "b2b_buyer";

      if (app.gst_number) {
        const { data, error: companyLookupError } = await supabase
          .from("companies")
          .select("id")
          .eq("gst_number", app.gst_number)
          .maybeSingle();

        if (companyLookupError) throw companyLookupError;
        if (data) companyId = data.id;
      }

      if (!companyId) {
        const { data, error: businessLookupError } = await supabase
          .from("companies")
          .select("id")
          .eq("business_name", app.business_name)
          .maybeSingle();

        if (businessLookupError) throw businessLookupError;
        if (data) companyId = data.id;
      }

      if (!companyId) {
        const { data, error: companyCreateError } = await supabase
          .from("companies")
          .insert({ business_name: app.business_name, gst_number: app.gst_number })
          .select()
          .single();

        if (companyCreateError) throw companyCreateError;
        companyId = data?.id ?? null;
      }

      // Write price_tier and account_manager_id to the company row.
      // This is the canonical slab assignment that the storefront reads.
      if (companyId) {
        const companyUpdate: Record<string, string | null> = {
          price_tier: priceTier[app.id],
        };
        if (accountManager[app.id]) {
          companyUpdate.account_manager_id = accountManager[app.id];
        }
        const { error: companyTierError } = await supabase
          .from("companies")
          .update(companyUpdate as Parameters<ReturnType<typeof supabase.from>["update"]>[0])
          .eq("id", companyId);
        if (companyTierError) throw companyTierError;
      }

      const [applicationUpdate, userUpdate, profileSync] = await Promise.all([
        supabase
          .from("b2b_applications")
          .update({
            status: "approved",
            admin_notes: notes[app.id] || null,
            assigned_price_tier: priceTier[app.id],
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id ?? null,
          })
          .eq("id", app.id),
        app.user_id && companyId
          ? supabase.from("users").update({ role: approvedRole, company_id: companyId }).eq("id", app.user_id)
          : Promise.resolve({ error: null }),
        app.user_id && companyId
          ? supabase.from("profiles").upsert(
              {
                id: app.user_id,
                role: approvedRole,
                company_id: companyId,
                is_approved: true,
                status: "approved",
                price_tier: priceTier[app.id],
              },
              { onConflict: "id" },
            )
          : Promise.resolve({ error: null }),
      ]);

      if (applicationUpdate.error) throw applicationUpdate.error;
      if (userUpdate.error) throw userUpdate.error;
      if (profileSync.error) throw profileSync.error;

      toast.success(`${app.business_name} approved`);

      notifyEvent({
        event: "approval_granted",
        subject: "Welcome to Oasis B2B! Your account is active",
        message: `Welcome to Oasis B2B! Your account is now active.\n\nLogin here: https://b2b.oasisbaklawa.com\n\nYour assigned tier: ${priceTier[app.id]}.\nYou can now place orders, track production live, and access invoices.\n\n— Team Oasis Baklawa`,
        audiences: [],
        email: app.contact_email,
        phone: app.mobile_number,
      }).catch(() => {});

      setSheetOpen(false);
      fetchApps(tab);
    } catch (error) {
      console.error("[AdminClients] Approval failed:", error);
      toast.error("Failed to approve client.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (app: Application) => {
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
    } else {
      toast.error("Failed to reject application.");
    }
    setActionLoading(null);
  };

  const handleRequestInfo = async (app: Application) => {
    const note = requestInfoNote[app.id]?.trim();
    if (!note) {
      toast.error("Enter a note describing what information is needed.");
      return;
    }
    setRequestingInfo(app.id);
    const { error } = await supabase
      .from("b2b_applications")
      .update({
        requested_info_at: new Date().toISOString(),
        requested_info_note: note,
        admin_notes: notes[app.id] || null,
      } as unknown as Parameters<ReturnType<typeof supabase.from>["update"]>[0])
      .eq("id", app.id);

    if (!error) {
      toast.success("Information request logged. Application remains pending.");
      setSheetOpen(false);
      fetchApps(tab);
    } else {
      toast.error("Failed to log request.");
    }
    setRequestingInfo(null);
  };

  const getInviteForApp = (appId: string) =>
    invites
      .filter((i) => i.application_id === appId)
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0] ?? null;

  const handleSendInvite = async (app: Application) => {
    if (!app.contact_email) {
      toast.error("No contact email available");
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
      setInvites((data as unknown as PortalInvite[]) ?? []);
    } else {
      toast.error("Failed to send portal invite.");
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
    if (editCreditLimit < 0) {
      toast.error("Credit limit cannot be negative.");
      return;
    }
    setIsUpdatingCompany(true);
    const { error } = await supabase
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
      toast.error("Failed to update client profile.");
    }
    setIsUpdatingCompany(false);
  };

  const filteredCompanies = activeCompanies.filter((c) =>
    (c.business_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
  );

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      <main className="space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <h1 className="text-display-h2 text-foreground flex items-center gap-3">
            <Users className="text-[#B8860B]" size={32} /> Client Governance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review applications and manage active B2B directories.{" "}
            <span className="text-muted-foreground/80">Route alias: /admin/approvals uses this screen.</span>
          </p>
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
              <p className="text-2xl font-semibold font-ui text-foreground">{stableCounts.active}</p>
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
                  <div className="space-y-3 p-6" aria-busy="true">
                    <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
                    <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
                    <div className="h-10 w-[66%] animate-pulse rounded-lg bg-muted" />
                  </div>
                ) : listError ? (
                  <div className="space-y-4 p-8 text-center" role="alert">
                    <p className="text-sm font-semibold text-destructive">Could not load this tab</p>
                    <p className="break-words text-xs text-muted-foreground">{listError}</p>
                    <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => void fetchApps(s)}>
                      Retry
                    </Button>
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
                  <div className="space-y-4 py-16 text-center" role="status">
                    <Users size={32} className="mx-auto text-muted-foreground/40 mb-2" aria-hidden />
                    <p className="text-sm text-muted-foreground">No {s} applications</p>
                    <Button type="button" variant="outline" size="sm" className="min-h-11 touch-manipulation" onClick={() => void fetchApps(s)}>
                      Refresh
                    </Button>
                  </div>
                ) : (
                  <>
                  <div className="space-y-3 border-b border-border p-4 md:hidden">
                    {apps.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setSelectedApp(a);
                          setSheetOpen(true);
                        }}
                        className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <p className="break-words font-semibold text-foreground">{a.business_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.city}, {a.state}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <Badge variant="outline" className={`text-[11px] font-semibold capitalize ${statusBadgeClass(a.status)}`}>
                            {a.status}
                          </Badge>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Open details</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
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
                          {apps.map((a) => (
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
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      {/* ─── Application Review Sheet ─── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-lg border-l border-border bg-background p-0"
        >
          {selectedApp && (
            <div className="flex h-full max-h-[100dvh] flex-col overflow-hidden">
              <div className="shrink-0 border-b border-border bg-muted/20 px-6 pb-4 pt-6">
                <SheetHeader className="space-y-1">
                  <SheetTitle className="break-words text-lg font-display text-foreground">{selectedApp.business_name}</SheetTitle>
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
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-6 py-5">
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</h4>
                  <div className="space-y-2.5">
                    <DetailRow icon={Building2} label="Contact Person" value={selectedApp.contact_person} />
                    <DetailRow icon={Mail} label="Email" value={selectedApp.contact_email} />
                    <DetailRow icon={Phone} label="Mobile" value={selectedApp.mobile_number} />
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Information</h4>
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
                <div className="max-h-[min(52vh,26rem)] shrink-0 space-y-4 overflow-y-auto overscroll-y-contain border-t border-border bg-muted/20 px-6 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Decision panel</p>
                  {/* Pricing Slab — mandatory */}
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Pricing Slab <span className="text-destructive">*</span>
                    </label>
                    {pricingSlabs.length === 0 ? (
                      <p className="mt-1.5 text-xs font-medium text-destructive">No active slabs found. Add slabs in Pricing settings before approving.</p>
                    ) : (
                      <Select
                        value={priceTier[selectedApp.id] || ""}
                        onValueChange={(v) => setPriceTier({ ...priceTier, [selectedApp.id]: v })}
                      >
                        <SelectTrigger className={`mt-1.5 rounded-lg bg-card ${!priceTier[selectedApp.id] ? "border-destructive/50" : ""}`}>
                          <SelectValue placeholder="Select pricing slab (required)…" />
                        </SelectTrigger>
                        <SelectContent>
                          {pricingSlabs.map((s) => (
                            <SelectItem key={s.id} value={s.slab_name}>
                              {s.slab_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!priceTier[selectedApp.id] && (
                      <p className="mt-1 text-[11px] text-destructive">Slab must be assigned before approval.</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Manager</label>
                    <Select
                      value={accountManager[selectedApp.id] || ""}
                      onValueChange={(v) => setAccountManager({ ...accountManager, [selectedApp.id]: v })}
                    >
                      <SelectTrigger className="mt-1.5 rounded-lg bg-card">
                        <SelectValue placeholder="Assign account manager (optional)…" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Notes</label>
                    <textarea
                      rows={2}
                      value={notes[selectedApp.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [selectedApp.id]: e.target.value })}
                      placeholder="Internal notes (optional)…"
                      className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-card/80 p-3">
                    <label htmlFor={`reject-reason-${selectedApp.id}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Rejection reason (optional, saved if you reject)
                    </label>
                    <textarea
                      id={`reject-reason-${selectedApp.id}`}
                      rows={2}
                      value={rejectionReason[selectedApp.id] || ""}
                      onChange={(e) => setRejectionReason({ ...rejectionReason, [selectedApp.id]: e.target.value })}
                      placeholder="Visible to auditors if this application is rejected…"
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Irreversible for this applicant</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <Button
                        type="button"
                        onClick={() => void handleApprove(selectedApp)}
                        disabled={actionLoading === selectedApp.id || !priceTier[selectedApp.id]}
                        title={!priceTier[selectedApp.id] ? "Select a pricing slab to enable approval" : undefined}
                        className="min-h-12 flex-1 touch-manipulation bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                        aria-label="Approve and activate B2B account"
                      >
                        {actionLoading === selectedApp.id ? (
                          <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden />
                        ) : (
                          <CheckCircle2 size={14} className="mr-1.5" aria-hidden />
                        )}
                        Approve & Activate
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleReject(selectedApp)}
                        disabled={actionLoading === selectedApp.id}
                        className="min-h-12 touch-manipulation border-destructive/50 font-semibold text-destructive hover:bg-destructive/10 sm:min-w-[7rem]"
                        aria-label="Reject application"
                      >
                        <XCircle size={14} className="mr-1.5" aria-hidden /> Reject
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-4">
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <AlertCircle size={11} aria-hidden /> Request More Information
                    </label>
                    <textarea
                      rows={2}
                      value={requestInfoNote[selectedApp.id] || ""}
                      onChange={(e) => setRequestInfoNote({ ...requestInfoNote, [selectedApp.id]: e.target.value })}
                      placeholder="Describe what documents or info is needed…"
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-full touch-manipulation text-xs font-semibold border-border sm:w-auto"
                      onClick={() => void handleRequestInfo(selectedApp)}
                      disabled={requestingInfo === selectedApp.id || !requestInfoNote[selectedApp.id]?.trim()}
                    >
                      {requestingInfo === selectedApp.id ? (
                        <Loader2 size={12} className="mr-1.5 animate-spin" aria-hidden />
                      ) : (
                        <Send size={12} className="mr-1.5" aria-hidden />
                      )}
                      Log Request (keeps pending)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      </main>

      {/* ─── Directory Edit Modal ─── */}
      <Dialog
        open={!!selectedCompany}
        onOpenChange={(open) => {
          if (!open) setSelectedCompany(null);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-md bg-white border-slate-200 rounded-3xl p-6 h-fit my-auto max-h-[90vh] overflow-y-auto"
        >
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
                min={0}
                value={editCreditLimit}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v < 0) {
                    toast.error("Credit limit cannot be negative.");
                    setEditCreditLimit(0);
                  } else {
                    setEditCreditLimit(v);
                  }
                }}
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
