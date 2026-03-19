import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2,
  Building2,
  User,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  X,
  FileText,
  Send,
  Clock,
  CheckCheck,
} from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

// ─── Types ───
interface Application {
  id: string;
  business_name: string;
  trade_name?: string | null;
  business_type?: string | null;
  contact_person: string;
  phone: string;
  email: string;
  gst_number: string | null;
  fssai_license?: string | null;
  expected_volume?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  user_id?: string | null;
  admin_notes?: string | null;
  rejection_reason?: string | null;
  assigned_price_tier?: string | null;
}

interface PortalInvite {
  id: string;
  application_id: string | null;
  invite_email: string;
  status: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
}

const ClientsGovernance = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedSlab, setSelectedSlab] = useState("Slab A (Standard)");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Invite states
  const [invites, setInvites] = useState<PortalInvite[]>([]);
  const [inviteSending, setInviteSending] = useState<string | null>(null);

  // 1. Fetch live data + Invites (STRICTLY SUPABASE ONLY)
  const fetchApplications = async () => {
    setLoading(true);
    const { data: appData, error: appError } = await supabase
      .from("b2b_applications")
      .select("*")
      .order("created_at", { ascending: false });

    setApplications((appData as Application[]) ?? []);

    const { data: inviteData } = await supabase.from("portal_access_invites").select("*");
    setInvites((inviteData as PortalInvite[]) ?? []);

    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // 2. The Approval Engine
  const handleApprove = async (app: Application) => {
    setProcessingId(app.id);

    // Update Application
    const { error } = await supabase
      .from("b2b_applications")
      .update({
        status: "approved",
        assigned_price_tier: selectedSlab,
        admin_notes: adminNotes || null,
      })
      .eq("id", app.id);

    if (error) {
      toast.error("Failed to approve application");
      setProcessingId(null);
      return;
    }

    // Auto-create Company Record
    let companyId = null;
    const { data: newCo } = await supabase
      .from("companies")
      .insert({
        business_name: app.business_name,
        gst_number: app.gst_number,
        business_volume: app.expected_volume,
      })
      .select()
      .single();

    if (newCo) companyId = newCo.id;

    // Update User Role if user_id exists
    if (app.user_id && companyId) {
      await supabase.from("users").update({ role: "buyer", company_id: companyId }).eq("id", app.user_id);
    }

    // Log Action
    await supabase.from("audit_logs").insert({
      action_type: "approve_client",
      module_name: "client_governance",
      entity_name: app.business_name,
      entity_id: app.id,
    });

    toast.success(`${app.business_name} approved successfully`);
    await fetchApplications();
    setSelectedApp(null);
    setProcessingId(null);
    setAdminNotes("");
  };

  // 3. The Rejection Engine
  const handleReject = async (app: Application) => {
    setProcessingId(app.id);
    const { error } = await supabase
      .from("b2b_applications")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason || null,
      })
      .eq("id", app.id);

    if (!error) {
      await supabase.from("audit_logs").insert({
        action_type: "reject_client",
        module_name: "client_governance",
        entity_name: app.business_name,
        entity_id: app.id,
        reason: rejectionReason,
      });
      toast.success(`${app.business_name} rejected`);
      await fetchApplications();
      setSelectedApp(null);
    }
    setProcessingId(null);
    setRejectionReason("");
  };

  // 4. Portal Invite Engine
  const handleSendInvite = async (app: Application) => {
    if (!app.email) {
      toast.error("No contact email found");
      return;
    }

    setInviteSending(app.id);
    const { error } = await supabase.from("portal_access_invites").insert({
      application_id: app.id,
      invite_email: app.email,
      status: "pending",
      sent_at: new Date().toISOString(),
    });

    if (!error) {
      toast.success(`Portal invite sent to ${app.email}`);
      const { data } = await supabase.from("portal_access_invites").select("*");
      setInvites((data as PortalInvite[]) ?? []);
    } else {
      toast.error("Failed to send invite");
    }
    setInviteSending(null);
  };

  const getInviteForApp = (appId: string) => invites.find((i) => i.application_id === appId) ?? null;

  const filteredApps = applications.filter((app) => app.status === activeTab);
  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-display-h2 text-foreground">Client Governance</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Review and approve wholesale applications</p>
        </motion.div>

        {/* --- KPI CARDS --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-card p-5 rounded-2xl border border-amber-200/50 shadow-sm">
            <AlertTriangle size={20} className="text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Pending Review</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-green-200/50 shadow-sm">
            <ShieldCheck size={20} className="text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{approvedCount}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Active Buyers</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm hidden md:block">
            <Building2 size={20} className="text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{applications.length}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Applications</p>
          </div>
        </div>

        {/* --- DATA TABLE SECTION --- */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-border bg-muted/10">
            {["pending", "approved", "rejected"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? "text-primary border-b-2 border-primary bg-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/20 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">Business Details</div>
            <div className="col-span-3">Contact Person</div>
            <div className="col-span-3">Applied Date</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border flex-1 overflow-y-auto">
            {filteredApps.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">No {activeTab} applications found.</div>
            ) : (
              filteredApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 cursor-pointer transition-colors group"
                >
                  <div className="col-span-4">
                    <p className="text-sm font-bold text-foreground">{app.business_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">GST: {app.gst_number || "N/A"}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm text-foreground">{app.contact_person}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{app.phone}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm text-foreground">
                      {new Date(app.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* --- SLIDE-OUT REVIEW PANEL (SHEET) --- */}
      <AnimatePresence>
        {selectedApp && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApp(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />

            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 border-l border-border flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
                <h2 className="text-lg font-display tracking-wide text-foreground">{selectedApp.business_name}</h2>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {/* Company Info */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Company Information
                  </h3>
                  <div className="bg-card p-4 rounded-xl border border-border space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">GST Number</p>
                        <p className="text-sm font-medium text-foreground">{selectedApp.gst_number || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Expected Volume</p>
                        <p className="text-sm font-medium text-foreground">{selectedApp.expected_volume || "N/A"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Registered Address</p>
                      <p className="text-sm font-medium text-foreground">{selectedApp.address}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Contact Details
                  </h3>
                  <div className="bg-card p-4 rounded-xl border border-border space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <User size={14} className="text-muted-foreground" /> {selectedApp.contact_person}
                    </p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Phone size={14} className="text-muted-foreground" /> {selectedApp.phone}
                    </p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Mail size={14} className="text-muted-foreground" /> {selectedApp.email}
                    </p>
                  </div>
                </div>

                {/* Pending Actions */}
                {selectedApp.status === "pending" && (
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Governance Action
                    </h3>
                    <div className="bg-muted/10 p-4 rounded-xl border border-border space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                          Assign Pricing Slab
                        </label>
                        <select
                          value={selectedSlab}
                          onChange={(e) => setSelectedSlab(e.target.value)}
                          className="w-full text-sm p-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary"
                        >
                          <option>Slab A (Standard Wholesale)</option>
                          <option>Slab B (High Volume)</option>
                          <option>Slab C (Distributor)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                          Admin Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Internal notes..."
                          className="w-full text-sm p-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => handleReject(selectedApp)}
                          disabled={processingId === selectedApp.id}
                          className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm font-bold"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                        <button
                          onClick={() => handleApprove(selectedApp)}
                          disabled={processingId === selectedApp.id}
                          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-bold shadow-md"
                        >
                          {processingId === selectedApp.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approved Actions (Portal Invite) */}
                {selectedApp.status === "approved" && (
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Portal Access
                    </h3>
                    <div className="bg-muted/10 p-4 rounded-xl border border-border space-y-4">
                      {getInviteForApp(selectedApp.id) ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                          <CheckCheck size={16} /> Invite Sent / Active
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">This buyer does not have portal access yet.</p>
                      )}

                      <button
                        onClick={() => handleSendInvite(selectedApp)}
                        disabled={inviteSending === selectedApp.id || !!getInviteForApp(selectedApp.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors text-sm font-bold"
                      >
                        {inviteSending === selectedApp.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                        {getInviteForApp(selectedApp.id) ? "Access Granted" : "Send Portal Invite"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientsGovernance;
