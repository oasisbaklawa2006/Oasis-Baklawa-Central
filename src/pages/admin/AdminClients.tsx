import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, CheckCircle2, XCircle, Send, Clock, CheckCheck,
  Users, UserCheck, AlertCircle, Building2, Phone, Mail, MapPin, FileText
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
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

interface PricingSlab { id: string; slab_name: string; }
interface PortalInvite {
  id: string; application_id: string | null; company_id: string | null;
  invite_email: string; status: string | null; sent_at: string | null;
  accepted_at: string | null; created_at: string | null; notes: string | null;
}

/* ─── dummy data ─── */
const DUMMY_APPS: Application[] = [
  {
    id: "d1", business_name: "Royal Sweets Emporium", trade_name: "Royal Sweets", business_type: "Distributor",
    contact_person: "Rajesh Sharma", contact_email: "rajesh@royalsweets.in", mobile_number: "+91 98765 43210",
    gst_number: "27AABCU9603R1ZM", expected_volume: "500-1000 kg", city: "Mumbai", state: "Maharashtra",
    registered_address: "42, Mithai Lane, Dadar West, Mumbai 400028", status: "pending",
    created_at: "2026-03-15T10:30:00Z", user_id: null, admin_notes: null, rejection_reason: null, assigned_price_tier: null,
  },
  {
    id: "d2", business_name: "Bombay Bakery House", trade_name: "BBH", business_type: "Retailer",
    contact_person: "Priya Mehta", contact_email: "priya@bbh.co.in", mobile_number: "+91 87654 32109",
    gst_number: "27AABCU9604R1ZN", expected_volume: "100-500 kg", city: "Pune", state: "Maharashtra",
    registered_address: "15, Baker Street, Koregaon Park, Pune 411001", status: "pending",
    created_at: "2026-03-14T08:15:00Z", user_id: null, admin_notes: null, rejection_reason: null, assigned_price_tier: null,
  },
  {
    id: "d3", business_name: "Delhi Dry Fruits Co.", trade_name: "DDFC", business_type: "Wholesaler",
    contact_person: "Amit Gupta", contact_email: "amit@ddfc.in", mobile_number: "+91 99876 54321",
    gst_number: "07AABCU9605R1ZO", expected_volume: "1000-5000 kg", city: "New Delhi", state: "Delhi",
    registered_address: "78, Chandni Chowk, Old Delhi 110006", status: "approved",
    created_at: "2026-03-10T14:00:00Z", user_id: null, admin_notes: "Premium client, priority processing",
    rejection_reason: null, assigned_price_tier: "Slab A",
  },
  {
    id: "d4", business_name: "Southern Spice Traders", trade_name: null, business_type: "Distributor",
    contact_person: "Karthik Nair", contact_email: "karthik@sst.in", mobile_number: "+91 77654 32108",
    gst_number: "32AABCU9606R1ZP", expected_volume: "100-500 kg", city: "Kochi", state: "Kerala",
    registered_address: "23, Spice Market Road, Mattancherry, Kochi 682002", status: "approved",
    created_at: "2026-03-08T11:20:00Z", user_id: null, admin_notes: null,
    rejection_reason: null, assigned_price_tier: "Slab B",
  },
  {
    id: "d5", business_name: "Himalayan Treats", trade_name: "HT", business_type: "Retailer",
    contact_person: "Sonam Dorji", contact_email: "sonam@ht.in", mobile_number: "+91 66543 21098",
    gst_number: null, expected_volume: "50-100 kg", city: "Shimla", state: "Himachal Pradesh",
    registered_address: "5, Mall Road, Shimla 171001", status: "rejected",
    created_at: "2026-03-05T09:00:00Z", user_id: null, admin_notes: "Incomplete documentation",
    rejection_reason: "Missing GST registration", assigned_price_tier: null,
  },
];

const DUMMY_SLABS: PricingSlab[] = [
  { id: "s1", slab_name: "Slab A" },
  { id: "s2", slab_name: "Slab B" },
  { id: "s3", slab_name: "Slab C" },
];

const STATUS_TABS = ["pending", "approved", "rejected"] as const;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "pending": return "bg-amber-50 text-amber-700 border-amber-200";
    case "approved": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "rejected": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

/* ─── Component ─── */
const AdminClients = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priceTier, setPriceTier] = useState<Record<string, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [pricingSlabs, setPricingSlabs] = useState<PricingSlab[]>(DUMMY_SLABS);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [invites, setInvites] = useState<PortalInvite[]>([]);

  /* load pricing slabs + invites */
  useEffect(() => {
    supabase.from("pricing_slabs").select("id, slab_name").eq("is_active", true).then(({ data }) => {
      if (data && data.length > 0) setPricingSlabs(data as PricingSlab[]);
    });
    supabase.from("portal_access_invites").select("*").then(({ data }) => {
      setInvites((data as PortalInvite[]) ?? []);
    });
  }, []);

  const fetchApps = async (status: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("b2b_applications")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });
    const dbApps = (data as Application[]) ?? [];
    // Merge dummy data for demo, real DB data takes priority
    const dummyForTab = DUMMY_APPS.filter(d => d.status === status);
    const merged = dbApps.length > 0 ? dbApps : dummyForTab;
    setApps(merged);
    setLoading(false);
  };

  useEffect(() => { fetchApps(tab); }, [tab]);

  /* counts for KPIs */
  const pendingCount = tab === "pending" ? apps.length : DUMMY_APPS.filter(d => d.status === "pending").length;
  const approvedCount = tab === "approved" ? apps.length : DUMMY_APPS.filter(d => d.status === "approved").length;
  const totalActive = approvedCount;

  /* ─── Approval logic (preserved) ─── */
  const handleApprove = async (app: Application) => {
    if (app.id.startsWith("d")) { toast.success(`${app.business_name} approved (demo)`); setSheetOpen(false); return; }
    setActionLoading(app.id);
    const { error } = await supabase.from("b2b_applications").update({
      status: "approved", admin_notes: notes[app.id] || null,
      assigned_price_tier: priceTier[app.id] || null,
      reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null,
    }).eq("id", app.id);
    if (error) { toast.error("Failed to approve"); setActionLoading(null); return; }

    let companyId: string | null = null;
    if (app.gst_number) {
      const { data: existing } = await supabase.from("companies").select("id").eq("gst_number", app.gst_number).maybeSingle();
      if (existing) companyId = existing.id;
    }
    if (!companyId) {
      const { data: byName } = await supabase.from("companies").select("id").eq("business_name", app.business_name).maybeSingle();
      if (byName) companyId = byName.id;
    }
    if (!companyId) {
      const { data: newCo } = await supabase.from("companies").insert({
        business_name: app.business_name, gst_number: app.gst_number, business_volume: app.expected_volume,
      }).select().single();
      if (newCo) companyId = newCo.id;
    }
    if (app.user_id && companyId) {
      await supabase.from("users").update({ role: "buyer", company_id: companyId }).eq("id", app.user_id);
    }
    await supabase.from("audit_logs").insert({
      action_type: "approve_client", module_name: "client_governance",
      entity_name: app.business_name, entity_id: app.id, actor_id: user?.id ?? null,
    });
    toast.success(`${app.business_name} approved`);
    setSheetOpen(false);
    fetchApps(tab);
    setActionLoading(null);
  };

  const handleReject = async (app: Application) => {
    if (app.id.startsWith("d")) { toast.success(`${app.business_name} rejected (demo)`); setSheetOpen(false); return; }
    setActionLoading(app.id);
    const { error } = await supabase.from("b2b_applications").update({
      status: "rejected", rejection_reason: rejectionReason[app.id] || null,
      admin_notes: notes[app.id] || null, reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null,
    }).eq("id", app.id);
    if (error) { toast.error("Failed to reject"); }
    else {
      await supabase.from("audit_logs").insert({
        action_type: "reject_client", module_name: "client_governance",
        entity_name: app.business_name, entity_id: app.id, actor_id: user?.id ?? null,
        reason: rejectionReason[app.id] || null,
      });
      toast.success(`${app.business_name} rejected`);
      setSheetOpen(false);
      fetchApps(tab);
    }
    setActionLoading(null);
  };

  const getInviteForApp = (appId: string) =>
    invites.filter(i => i.application_id === appId).sort((a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )[0] ?? null;

  const handleSendInvite = async (app: Application) => {
    if (!app.contact_email) { toast.error("No contact email"); return; }
    const existing = getInviteForApp(app.id);
    if (existing && existing.status === "pending") { toast.error("A pending invite already exists"); return; }
    if (app.id.startsWith("d")) { toast.success(`Portal invite sent to ${app.contact_email} (demo)`); return; }
    setInviteSending(app.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("portal_access_invites").insert({
      application_id: app.id, invite_email: app.contact_email,
      notes: `Portal access invite for ${app.business_name}`, status: "pending", sent_at: now,
    });
    if (error) { toast.error("Failed to send invite: " + error.message); }
    else {
      await supabase.from("audit_logs").insert({
        action_type: "send_portal_invite", module_name: "client_governance",
        entity_name: app.business_name, entity_id: app.id, actor_id: user?.id ?? null,
      });
      toast.success(`Portal invite sent to ${app.contact_email}`);
      const { data: newInvites } = await supabase.from("portal_access_invites").select("*");
      setInvites((newInvites as PortalInvite[]) ?? []);
    }
    setInviteSending(null);
  };

  const openSheet = (app: Application) => {
    setSelectedApp(app);
    setSheetOpen(true);
  };

  /* ─── KPI Card ─── */
  const KpiCard = ({ icon: Icon, label, value, accent }: {
    icon: React.ElementType; label: string; value: number; accent: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold font-ui text-foreground">{value}</p>
        <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</p>
      </div>
    </motion.div>
  );

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <h1 className="text-display-h2 text-foreground">Client Governance</h1>
        <p className="text-sm text-muted-foreground mt-1">Review, approve, and manage B2B wholesale applications</p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={AlertCircle} label="Pending Review" value={pendingCount} accent="bg-amber-50 text-amber-600" />
        <KpiCard icon={UserCheck} label="Recently Approved" value={approvedCount} accent="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={Users} label="Total Active Buyers" value={totalActive} accent="bg-primary/10 text-primary" />
      </div>

      {/* Tabs + Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      >
        <Tabs value={tab} onValueChange={setTab}>
          <div className="px-5 pt-4 pb-0">
            <TabsList className="bg-muted/40 p-1">
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s} value={s} className="capitalize text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm px-5">
                  {s}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {STATUS_TABS.map((s) => (
            <TabsContent key={s} value={s} className="mt-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-primary" />
                </div>
              ) : apps.length === 0 ? (
                <div className="py-16 text-center">
                  <Users size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No {s} applications</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Name</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Person</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applied Date</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {apps.map((a, i) => (
                          <motion.tr
                            key={a.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.04 }}
                            onClick={() => openSheet(a)}
                            className="border-b border-border cursor-pointer transition-colors hover:bg-muted/20 group"
                          >
                            <TableCell className="py-4">
                              <div>
                                <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{a.business_name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{a.city}, {a.state}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <p className="text-sm text-foreground">{a.contact_person || "—"}</p>
                              <p className="text-xs text-muted-foreground">{a.contact_email}</p>
                            </TableCell>
                            <TableCell className="py-4 text-sm text-muted-foreground">{fmtDate(a.created_at)}</TableCell>
                            <TableCell className="py-4 text-right">
                              <Badge variant="outline" className={`text-[11px] font-semibold capitalize ${statusBadgeClass(a.status)}`}>
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

      {/* ─── Review Sheet (Slide-Out) ─── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l border-border bg-background p-0">
          {selectedApp && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              {/* Sheet Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border bg-muted/20">
                <SheetHeader className="space-y-1">
                  <SheetTitle className="text-lg font-display text-foreground">{selectedApp.business_name}</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    {selectedApp.trade_name ? `Trade: ${selectedApp.trade_name} · ` : ""}{selectedApp.business_type || "Business"}
                  </SheetDescription>
                </SheetHeader>
                <Badge variant="outline" className={`mt-3 text-[11px] font-semibold capitalize ${statusBadgeClass(selectedApp.status)}`}>
                  {selectedApp.status}
                </Badge>
              </div>

              {/* Details */}
              <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto">
                {/* Contact Section */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contact Details</h4>
                  <div className="space-y-2.5">
                    <DetailRow icon={Building2} label="Contact Person" value={selectedApp.contact_person} />
                    <DetailRow icon={Mail} label="Email" value={selectedApp.contact_email} />
                    <DetailRow icon={Phone} label="Mobile" value={selectedApp.mobile_number} />
                  </div>
                </div>

                <Separator />

                {/* Business Section */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Business Information</h4>
                  <div className="space-y-2.5">
                    <DetailRow icon={FileText} label="GSTIN" value={selectedApp.gst_number} />
                    <DetailRow icon={MapPin} label="Address" value={selectedApp.registered_address || `${selectedApp.city}, ${selectedApp.state}`} />
                    <DetailRow icon={Users} label="Expected Volume" value={selectedApp.expected_volume} />
                  </div>
                </div>

                {/* Assigned tier for approved */}
                {selectedApp.assigned_price_tier && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assigned Pricing</h4>
                      <Badge className="bg-primary/10 text-primary border-primary/20">{selectedApp.assigned_price_tier}</Badge>
                    </div>
                  </>
                )}

                {/* Admin notes / rejection reason */}
                {selectedApp.admin_notes && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Admin Notes</p>
                    <p className="text-sm text-foreground">{selectedApp.admin_notes}</p>
                  </div>
                )}
                {selectedApp.rejection_reason && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-600 mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-700">{selectedApp.rejection_reason}</p>
                  </div>
                )}

                {/* Portal invite status for approved */}
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

              {/* ─── Action Area (pending only) ─── */}
              {selectedApp.status === "pending" && (
                <div className="border-t border-border px-6 py-5 bg-muted/10 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing Slab</label>
                    <Select
                      value={priceTier[selectedApp.id] || ""}
                      onValueChange={(v) => setPriceTier({ ...priceTier, [selectedApp.id]: v })}
                    >
                      <SelectTrigger className="mt-1.5 rounded-lg bg-card">
                        <SelectValue placeholder="Select pricing slab…" />
                      </SelectTrigger>
                      <SelectContent>
                        {pricingSlabs.map((slab) => (
                          <SelectItem key={slab.id} value={slab.slab_name}>{slab.slab_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Notes</label>
                    <Input
                      placeholder="Internal notes (optional)"
                      className="mt-1.5 rounded-lg bg-card"
                      value={notes[selectedApp.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [selectedApp.id]: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rejection Reason</label>
                    <Textarea
                      placeholder="If rejecting, state reason (optional)…"
                      className="mt-1.5 rounded-lg bg-card"
                      rows={2}
                      value={rejectionReason[selectedApp.id] || ""}
                      onChange={(e) => setRejectionReason({ ...rejectionReason, [selectedApp.id]: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button
                      onClick={() => handleApprove(selectedApp)}
                      disabled={actionLoading === selectedApp.id}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
                    >
                      {actionLoading === selectedApp.id ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}
                      Approve & Assign
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleReject(selectedApp)}
                      disabled={actionLoading === selectedApp.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold rounded-lg"
                    >
                      <XCircle size={14} className="mr-1.5" /> Reject
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ─── Sub-components ─── */
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

const PortalInviteSection = ({ app, invite, onSendInvite, sending }: {
  app: Application; invite: PortalInvite | null; onSendInvite: (a: Application) => void; sending: boolean;
}) => (
  <div className="space-y-3">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portal Access</h4>
    {invite ? (
      <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {invite.status === "accepted" ? <CheckCheck size={14} className="text-emerald-600" /> : <Clock size={14} className="text-amber-600" />}
          <span className="text-sm font-semibold text-foreground">{invite.status === "accepted" ? "Portal Active" : "Invite Pending"}</span>
        </div>
        <p className="text-xs text-muted-foreground">Sent: {invite.sent_at ? new Date(invite.sent_at).toLocaleDateString() : "—"}</p>
        {invite.accepted_at && <p className="text-xs text-muted-foreground">Accepted: {new Date(invite.accepted_at).toLocaleDateString()}</p>}
      </div>
    ) : (
      <div className="bg-red-50 rounded-lg p-3">
        <p className="text-sm font-semibold text-red-700">Portal not activated</p>
        <p className="text-xs text-red-600 mt-0.5">Send a portal invite to enable login access.</p>
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
