import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Eye, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

const STATUS_TABS = ["pending", "approved", "rejected", "suspended"] as const;

const AdminClients = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priceTier, setPriceTier] = useState<Record<string, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

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

  const handleApprove = async (app: Application) => {
    setActionLoading(app.id);
    const { error } = await supabase.from("b2b_applications").update({
      status: "approved",
      admin_notes: notes[app.id] || null,
      assigned_price_tier: priceTier[app.id] || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", app.id);

    if (error) { toast.error("Failed to approve"); }
    else {
      toast.success(`${app.business_name} approved`);
      // Create company
      if (app.user_id) {
        const { data: newCo } = await supabase.from("companies").insert({
          business_name: app.business_name,
          gst_number: app.gst_number,
          business_volume: app.expected_volume,
        }).select().single();
        if (newCo) {
          await supabase.from("users").update({ role: "buyer", company_id: newCo.id }).eq("id", app.user_id);
        }
      }
      // Audit log
      await supabase.from("audit_logs").insert({
        action_type: "approve_client",
        module_name: "client_governance",
        entity_name: app.business_name,
        entity_id: app.id,
      });
      fetchApps(tab);
    }
    setActionLoading(null);
  };

  const handleReject = async (app: Application) => {
    if (!rejectionReason[app.id]?.trim()) { toast.error("Please provide a rejection reason"); return; }
    setActionLoading(app.id);
    const { error } = await supabase.from("b2b_applications").update({
      status: "rejected",
      rejection_reason: rejectionReason[app.id],
      admin_notes: notes[app.id] || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", app.id);

    if (error) { toast.error("Failed to reject"); }
    else {
      toast.success(`${app.business_name} rejected`);
      await supabase.from("audit_logs").insert({
        action_type: "reject_client",
        module_name: "client_governance",
        entity_name: app.business_name,
        entity_id: app.id,
        reason: rejectionReason[app.id],
      });
      fetchApps(tab);
    }
    setActionLoading(null);
  };

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
                {apps.map((a) => (
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
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          a.status === "pending" ? "bg-amber-100 text-amber-700" :
                          a.status === "approved" ? "bg-green-100 text-green-700" :
                          a.status === "rejected" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>{a.status}</span>
                        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expandedId === a.id ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {expandedId === a.id && (
                      <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
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

                        {tab === "pending" && (
                          <div className="space-y-3 pt-2 border-t border-border">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-ui-label text-muted-foreground">Price Tier Assignment</label>
                                <Input placeholder="e.g. Tier A, Tier B" className="rounded-lg mt-1" value={priceTier[a.id] || ""} onChange={(e) => setPriceTier({ ...priceTier, [a.id]: e.target.value })} />
                              </div>
                              <div>
                                <label className="text-ui-label text-muted-foreground">Admin Notes</label>
                                <Input placeholder="Internal notes" className="rounded-lg mt-1" value={notes[a.id] || ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} />
                              </div>
                            </div>
                            <div>
                              <label className="text-ui-label text-muted-foreground">Rejection Reason (required if rejecting)</label>
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
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminClients;
