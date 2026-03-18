import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, ChevronDown, Send, Clock, CheckCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const STATUS_TABS = ["pending", "approved", "rejected", "suspended"] as const;

const AdminClients = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priceTier, setPriceTier] = useState<Record<string, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [pricingSlabs, setPricingSlabs] = useState<PricingSlab[]>([]);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [invites, setInvites] = useState<PortalInvite[]>([]);

  /* load pricing slabs + invites */
  useEffect(() => {
    supabase.from("pricing_slabs").select("id, slab_name").eq("is_active", true).then(({ data }) => {
      setPricingSlabs((data as PricingSlab[]) ?? []);
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
    setApps((data as Application[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchApps(tab); }, [tab]);

  /* ─── Deduplicated Company Creation on Approval ─── */
  const handleApprove = async (app: Application) => {
    setActionLoading(app.id);

    // 1. Update application status
    const { error } = await supabase.from("b2b_applications").update({
      status: "approved",
      admin_notes: notes[app.id] || null,
      assigned_price_tier: priceTier[app.id] || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    }).eq("id", app.id);

    if (error) { toast.error("Failed to approve"); setActionLoading(null); return; }

    // 2. Check for existing company (by GST, email, or name)
    let companyId: string | null = null;
    if (app.gst_number) {
      const { data: existing } = await supabase.from("companies")
        .select("id").eq("gst_number", app.gst_number).maybeSingle();
      if (existing) companyId = existing.id;
    }
    if (!companyId) {
      const { data: byName } = await supabase.from("companies")
        .select("id").eq("business_name", app.business_name).maybeSingle();
      if (byName) companyId = byName.id;
    }

    // 3. Create company only if not found
    if (!companyId) {
      const { data: newCo } = await supabase.from("companies").insert({
        business_name: app.business_name,
        gst_number: app.gst_number,
        business_volume: app.expected_volume,
      }).select().single();
      if (newCo) companyId = newCo.id;
    }

    // 4. Link user to company
    if (app.user_id && companyId) {
      await supabase.from("users").update({ role: "buyer", company_id: companyId }).eq("id", app.user_id);
    }

    // 5. Audit
    await supabase.from("audit_logs").insert({
      action_type: "approve_client",
      module_name: "client_governance",
      entity_name: app.business_name,
      entity_id: app.id,
      actor_id: user?.id ?? null,
    });

    toast.success(`${app.business_name} approved`);
    fetchApps(tab);
    setActionLoading(null);
  };

  const handleReject = async (app: Application) => {
    setActionLoading(app.id);
    const { error } = await supabase.from("b2b_applications").update({
      status: "rejected",
      rejection_reason: rejectionReason[app.id] || null,
      admin_notes: notes[app.id] || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    }).eq("id", app.id);

    if (error) { toast.error("Failed to reject"); }
    else {
      toast.success(`${app.business_name} rejected`);
      await supabase.from("audit_logs").insert({
        action_type: "reject_client",
        module_name: "client_governance",
        entity_name: app.business_name,
        entity_id: app.id,
        actor_id: user?.id ?? null,
        reason: rejectionReason[app.id] || null,
      });
      fetchApps(tab);
    }
    setActionLoading(null);
  };

  /* ─── Portal Access Invite ─── */
  const getInviteForApp = (appId: string) =>
    invites.filter(i => i.application_id === appId).sort((a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )[0] ?? null;

  const handleSendInvite = async (app: Application) => {
    if (!app.contact_email) { toast.error("No contact email"); return; }

    // Prevent duplicate pending invites
    const existing = getInviteForApp(app.id);
    if (existing && existing.status === "pending") {
      toast.error("A pending invite already exists for this applicant");
      return;
    }

    setInviteSending(app.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("portal_access_invites").insert({
      application_id: app.id,
      invite_email: app.contact_email,
      notes: `Portal access invite for ${app.business_name}`,
      status: "pending",
      sent_at: now,
    });

    if (error) {
      toast.error("Failed to send invite: " + error.message);
    } else {
      // Audit
      await supabase.from("audit_logs").insert({
        action_type: "send_portal_invite",
        module_name: "client_governance",
        entity_name: app.business_name,
        entity_id: app.id,
        actor_id: user?.id ?? null,
      });
      toast.success(`Portal invite sent to ${app.contact_email}`);
      // Refresh invites
      const { data: newInvites } = await supabase.from("portal_access_invites").select("*");
      setInvites((newInvites as PortalInvite[]) ?? []);
    }
    setInviteSending(null);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">Client Governance</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize text-ui-label">{s}</TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((s) => (
          <TabsContent key={s} value={s}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : apps.length === 0 ? (
              <p className="text-ui-label text-muted-foreground py-8">No {s} applications.</p>
            ) : (
              <div className="space-y-3">
                {apps.map((a) => {
                  const invite = getInviteForApp(a.id);
                  return (
                    <div key={a.id} className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                      <button
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left"
                      >
                        <div>
                          <p className="text-ui-h5 text-foreground">{a.business_name}</p>
                          <p className="text-fine text-muted-foreground">{a.contact_email} · {a.city}, {a.state}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Portal status indicator for approved */}
                          {tab === "approved" && (
                            invite ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                invite.status === "accepted" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              }`}>
                                {invite.status === "accepted" ? "Portal Active" : "Invite Sent"}
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Not Activated</span>
                            )
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            a.status === "pending" ? "bg-amber-100 text-amber-700" :
                            a.status === "approved" ? "bg-green-100 text-green-700" :
                            a.status === "rejected" ? "bg-red-100 text-red-700" :
                            "bg-muted text-muted-foreground"
                          }`}>{a.status}</span>
                          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expandedId === a.id ? "rotate-180" : ""}`} />
                        </div>
                      </button>

                      {expandedId === a.id && (
                        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                          {/* Detail grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            <div><span className="text-ui-label text-muted-foreground block">Trade Name</span><span className="text-ui-cell text-foreground">{a.trade_name || "—"}</span></div>
                            <div><span className="text-ui-label text-muted-foreground block">Business Type</span><span className="text-ui-cell text-foreground">{a.business_type || "—"}</span></div>
                            <div><span className="text-ui-label text-muted-foreground block">Contact</span><span className="text-ui-cell text-foreground">{a.contact_person || "—"}</span></div>
                            <div><span className="text-ui-label text-muted-foreground block">Mobile</span><span className="text-ui-cell text-foreground">{a.mobile_number || "—"}</span></div>
                            <div><span className="text-ui-label text-muted-foreground block">GST</span><span className="text-ui-cell text-foreground">{a.gst_number || "—"}</span></div>
                            <div><span className="text-ui-label text-muted-foreground block">Volume</span><span className="text-ui-cell text-foreground">{a.expected_volume || "—"}</span></div>
                            <div><span className="text-ui-label text-muted-foreground block">Applied</span><span className="text-ui-cell text-foreground">{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</span></div>
                            {a.assigned_price_tier && <div><span className="text-ui-label text-muted-foreground block">Price Tier</span><span className="text-ui-cell text-foreground">{a.assigned_price_tier}</span></div>}
                            {a.rejection_reason && <div className="col-span-2"><span className="text-ui-label text-muted-foreground block">Rejection Reason</span><span className="text-ui-cell text-destructive">{a.rejection_reason}</span></div>}
                          </div>

                          {/* Approved: Portal Invite Lifecycle */}
                          {tab === "approved" && (
                            <div className="pt-2 border-t border-border space-y-3">
                              <h4 className="text-ui-h5 text-foreground">Portal Access</h4>

                              {invite ? (
                                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                                  <div className="flex items-center gap-2">
                                    {invite.status === "accepted" ? (
                                      <CheckCheck size={14} className="text-green-600" />
                                    ) : (
                                      <Clock size={14} className="text-amber-600" />
                                    )}
                                    <span className="text-ui-cell text-foreground font-medium">
                                      {invite.status === "accepted" ? "Portal Active" : "Invite Pending"}
                                    </span>
                                  </div>
                                  <p className="text-fine text-muted-foreground">Email: {invite.invite_email}</p>
                                  <p className="text-fine text-muted-foreground">Sent: {fmtDate(invite.sent_at)}</p>
                                  {invite.accepted_at && (
                                    <p className="text-fine text-muted-foreground">Accepted: {fmtDate(invite.accepted_at)}</p>
                                  )}

                                  {invite.status === "pending" && (
                                    <p className="text-fine text-amber-600 mt-1">
                                      Applicant cannot log in until invite is accepted. Pending invite already exists.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-red-50 rounded-lg p-3">
                                  <p className="text-ui-cell text-red-700 font-medium">Portal not activated</p>
                                  <p className="text-fine text-red-600 mt-1">This approved applicant cannot log in. Send a portal access invite to enable login.</p>
                                </div>
                              )}

                              <button
                                onClick={() => handleSendInvite(a)}
                                disabled={inviteSending === a.id || (invite?.status === "pending")}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                              >
                                {inviteSending === a.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                {invite?.status === "pending" ? "Invite Already Sent" : "Send Portal Access Invite"}
                              </button>
                            </div>
                          )}

                          {/* Pending: Approval actions */}
                          {tab === "pending" && (
                            <div className="space-y-3 pt-2 border-t border-border">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-ui-label text-muted-foreground">Price Tier Assignment</label>
                                  <Select value={priceTier[a.id] || ""} onValueChange={(v) => setPriceTier({ ...priceTier, [a.id]: v })}>
                                    <SelectTrigger className="rounded-lg mt-1">
                                      <SelectValue placeholder="Select pricing slab" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {pricingSlabs.map((slab) => (
                                        <SelectItem key={slab.id} value={slab.slab_name}>{slab.slab_name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-ui-label text-muted-foreground">Admin Notes (optional)</label>
                                  <Input placeholder="Internal notes" className="rounded-lg mt-1" value={notes[a.id] || ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} />
                                </div>
                              </div>
                              <div>
                                <label className="text-ui-label text-muted-foreground">Rejection Reason (optional)</label>
                                <Textarea placeholder="Reason for rejection…" className="rounded-lg mt-1" rows={2} value={rejectionReason[a.id] || ""} onChange={(e) => setRejectionReason({ ...rejectionReason, [a.id]: e.target.value })} />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleApprove(a)} disabled={actionLoading === a.id}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50">
                                  <CheckCircle2 size={14} /> Approve
                                </button>
                                <button onClick={() => handleReject(a)} disabled={actionLoading === a.id}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50">
                                  <XCircle size={14} /> Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminClients;
