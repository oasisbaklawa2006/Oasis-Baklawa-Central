import { useEffect, useState, useCallback, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Clock, User, Star, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import ComplaintHandoffPanel from "@/components/admin/support/ComplaintHandoffPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canLinkComplaintReturn, canResolveCommercialComplaint, isBridgeId } from "@/lib/support/complaintBridge";
import { Badge } from "@/components/ui/badge";
import { computeSupportTicketSlaState, isSupportTicketActive, isSupportTicketSlaBreached } from "@/lib/support/supportTicketPolicy";

interface Ticket {
  id: string;
  order_id: string;
  issue_type: string;
  description: string;
  status: string | null;
  created_at: string | null;
  product_sku: string | null;
  qty_affected: number | null;
  proof_url: string | null;
  dispatch_date: string | null;
  routed_to_department: string | null;
  assigned_employee_id: string | null;
  sla_first_response_due: string | null;
  sla_action_due: string | null;
  sla_resolution_due: string | null;
  sla_first_response_at: string | null;
  sla_action_at: string | null;
  sla_resolved_at: string | null;
  sla_state: string | null;
  severity: string | null;
  estimated_financial_loss: number | null;
  customer_rating: number | null;
  admin_rating_speed: number | null;
  admin_rating_quality: number | null;
  admin_rating_communication: number | null;
  escalated_to_hod: boolean | null;
  commission_blocked: boolean | null;
}

interface StaffUser {
  id: string;
  full_name: string | null;
  email: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-destructive/10 text-destructive",
};

const SLA_COLORS: Record<string, string> = {
  "On Time": "bg-green-100 text-green-700",
  "Late": "bg-amber-100 text-amber-700",
  "No Response": "bg-orange-100 text-orange-700",
  "NEVER_RESPONDED": "bg-destructive/10 text-destructive",
  "pending": "bg-muted text-muted-foreground",
};

const formatTimeLeft = (due: string | null): string => {
  if (!due) return "—";
  const diff = new Date(due).getTime() - Date.now();
  if (diff <= 0) return "OVERDUE";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

const AdminSupport = () => {
  const { user, role } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "resolved" | "offenders">("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [ticketRes, staffRes] = await Promise.all([
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("users").select("id, full_name, email").not("role", "is", null),
    ]);
    setTickets((ticketRes.data as Ticket[]) ?? []);
    setStaff((staffRes.data as StaffUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeSupportTicket = async (ticket: Ticket) => {
    if (!canLinkComplaintReturn(role)) return;
    setResolving(ticket.id);
    const { error } = await supabase
      .from("support_tickets")
      .update((() => {
        const resolvedAt = new Date().toISOString();
        return {
          status: "resolved",
          sla_resolved_at: resolvedAt,
          sla_state: computeSupportTicketSlaState({ ...ticket, sla_resolved_at: resolvedAt }, new Date(resolvedAt)),
        };
      })())
      .eq("id", ticket.id);
    if (error) toast.error("Failed to update");
    else {
      await supabase.from("audit_logs").insert({
        action_type: "resolve_support_ticket",
        module_name: "support",
        entity_name: ticket.issue_type,
        entity_id: ticket.id,
        actor_id: user?.id ?? null,
      });
      toast.success("Support ticket closed");
      fetchAll();
    }
    setResolving(null);
  };

  const handleAssign = async (ticketId: string, employeeId: string) => {
    const now = new Date();
    const { error } = await supabase.from("support_tickets").update({
      assigned_employee_id: employeeId,
      sla_first_response_due: new Date(now.getTime() + 2 * 3600000).toISOString(),
      sla_action_due: new Date(now.getTime() + 24 * 3600000).toISOString(),
      sla_resolution_due: new Date(now.getTime() + 72 * 3600000).toISOString(),
    }).eq("id", ticketId);
    if (error) toast.error("Assignment failed");
    else { toast.success("Assigned & SLA timers started"); fetchAll(); }
  };

  const handleAdminRate = async (ticketId: string, speed: number, quality: number, comm: number) => {
    await supabase.from("support_tickets").update({
      admin_rating_speed: speed,
      admin_rating_quality: quality,
      admin_rating_communication: comm,
    }).eq("id", ticketId);
    toast.success("Admin rating saved");
    fetchAll();
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
  const getStaffName = (id: string | null) => {
    if (!id) return "Unassigned";
    const s = staff.find(u => u.id === id);
    return s?.full_name || s?.email || id.slice(0, 8);
  };

  const activeTickets = tickets.filter(isSupportTicketActive);
  const resolvedTickets = tickets.filter(t => t.status === "resolved");

  // Top Offenders: staff with NEVER_RESPONDED tickets
  const offenderMap = new Map<string, number>();
  tickets.forEach(t => {
    if (computeSupportTicketSlaState(t) === "NEVER_RESPONDED" && t.assigned_employee_id) {
      offenderMap.set(t.assigned_employee_id, (offenderMap.get(t.assigned_employee_id) || 0) + 1);
    }
  });
  const offenders = Array.from(offenderMap.entries())
    .map(([id, count]) => ({ id, name: getStaffName(id), count }))
    .sort((a, b) => b.count - a.count);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  const tabs = [
    { key: "active" as const, label: `Active (${activeTickets.length})` },
    { key: "resolved" as const, label: `Closed tickets (${resolvedTickets.length})` },
    { key: "offenders" as const, label: `Top Offenders (${offenders.length})` },
  ];

  const renderTicketRow = (t: Ticket) => {
    const sla = computeSupportTicketSlaState(t);
    const isExpanded = expandedId === t.id;
    return (
      <div key={t.id} className="border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedId(isExpanded ? null : t.id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{t.issue_type}</span>
              <Badge className={SEVERITY_COLORS[t.severity || "Medium"]} variant="secondary">{t.severity || "Medium"}</Badge>
              <Badge className={SLA_COLORS[sla]} variant="secondary">
                <Clock size={10} className="mr-1" />{sla}
              </Badge>
              {t.commission_blocked && <Badge variant="destructive">₹ BLOCKED</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{fmtDate(t.created_at)}</span>
              <span>Order: {t.order_id?.slice(0, 8)}…</span>
              {t.product_sku && <span>SKU: {t.product_sku}</span>}
              {t.routed_to_department && <span>→ {t.routed_to_department}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground"><User size={12} className="inline mr-1" />{getStaffName(t.assigned_employee_id)}</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 bg-muted/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">Qty Affected:</span> <span className="text-foreground font-medium">{t.qty_affected ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Estimated Loss:</span> <span className="text-foreground font-medium">₹{t.estimated_financial_loss ?? 0}</span></div>
              <div><span className="text-muted-foreground">1st Response:</span> <span className={`font-medium ${t.sla_first_response_at ? "text-green-600" : "text-destructive"}`}>{t.sla_first_response_at ? "Done" : formatTimeLeft(t.sla_first_response_due)}</span></div>
              <div><span className="text-muted-foreground">Support SLA:</span> <span className={`font-medium ${t.sla_resolved_at ? "text-green-600" : "text-destructive"}`}>{t.sla_resolved_at ? "Done" : formatTimeLeft(t.sla_resolution_due)}</span></div>
            </div>

            {t.proof_url && (
              <a href={t.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">View Proof</a>
            )}

            <p className="text-xs text-muted-foreground">{t.description}</p>
            <p className="break-all text-xs">Support ticket ID · {t.id}</p>

            {user && canLinkComplaintReturn(role) && (
              <ComplaintHandoffPanel
                key={`${user.id}:${t.id}`}
                ticketId={t.id}
                actorId={user.id}
                role={role}
                queueAction={t.status !== "resolved" && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void closeSupportTicket(t)} disabled={resolving === t.id}>
                    {resolving === t.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Close support ticket
                  </Button>
                )}
              />
            )}

            {/* Assign employee */}
            {!t.assigned_employee_id && t.status !== "resolved" && (
              <div className="flex items-center gap-2">
                <select
                  className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card text-foreground"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) handleAssign(t.id, e.target.value); }}
                >
                  <option value="" disabled>Assign to…</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                </select>
              </div>
            )}

            {t.status === "resolved" && !t.admin_rating_speed && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground">Admin Audit Rating</p>
                <div className="flex gap-4">
                  {(["Speed", "Quality", "Communication"] as const).map((label, i) => (
                    <div key={label} className="text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => {
                              const vals = [t.admin_rating_speed || 3, t.admin_rating_quality || 3, t.admin_rating_communication || 3];
                              vals[i] = n;
                              handleAdminRate(t.id, vals[0], vals[1], vals[2]);
                            }}
                            className="w-5 h-5 rounded-full border border-border text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors"
                          >{n}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {t.customer_rating && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star size={12} className="text-amber-500" /> Customer: {t.customer_rating}/5
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display-h2 text-foreground">Support queue</h1>
        <button onClick={fetchAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* SLA Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: activeTickets.length, color: "text-primary" },
          { label: "SLA Breached", value: activeTickets.filter(t => isSupportTicketSlaBreached(t)).length, color: "text-destructive" },
          { label: "Never Responded", value: activeTickets.filter(t => computeSupportTicketSlaState(t) === "NEVER_RESPONDED").length, color: "text-destructive" },
          { label: "Avg Support Closure", value: resolvedTickets.length > 0 ? `${Math.round(resolvedTickets.reduce((sum, t) => {
            if (!t.created_at || !t.sla_resolved_at) return sum;
            return sum + (new Date(t.sla_resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000;
          }, 0) / resolvedTickets.length)}h` : "—", color: "text-foreground" },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Active Tickets */}
      {tab === "active" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {activeTickets.length === 0
            ? <p className="p-6 text-sm text-muted-foreground">No active support tickets.</p>
            : activeTickets.map(renderTicketRow)
          }
        </div>
      )}

      {/* Resolved */}
      {tab === "resolved" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {resolvedTickets.length === 0
            ? <p className="p-6 text-sm text-muted-foreground">No closed support tickets.</p>
            : resolvedTickets.map(renderTicketRow)
          }
        </div>
      )}

      {/* Top Offenders */}
      {tab === "offenders" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {offenders.length === 0
            ? <p className="p-6 text-sm text-muted-foreground">No offenders detected.</p>
            : (
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Never Responded</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Penalty</th>
                </tr></thead>
                <tbody>
                  {offenders.map(o => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-4 py-3 text-foreground">{o.name}</td>
                      <td className="px-4 py-3"><Badge variant="destructive">{o.count}</Badge></td>
                      <td className="px-4 py-3 text-destructive font-bold">-{o.count * 25} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  );
};

export function FinanceComplaintLookup() {
  const { user, role } = useAuth();
  const [input, setInput] = useState("");
  const [ticketId, setTicketId] = useState("");
  const id = input.trim();

  if (!user || !canResolveCommercialComplaint(role)) return <Navigate to="/admin/finance" replace />;

  function lookup(event: FormEvent) {
    event.preventDefault();
    if (isBridgeId(id)) setTicketId(id.toLowerCase());
  }

  return (
    <div className="space-y-4">
      <h1 className="text-display-h2 text-foreground">Commercial complaint resolution</h1>
      <form onSubmit={lookup} className="space-y-1">
        <label htmlFor="complaint-ticket-id" className="text-sm font-medium">Support ticket ID from the handoff</label>
        <div className="flex flex-wrap gap-2">
          <Input id="complaint-ticket-id" className="max-w-sm" value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setTicketId("");
            }} />
          <Button type="submit" disabled={!isBridgeId(id)}>Find complaint</Button>
        </div>
      </form>
      {ticketId && <ComplaintHandoffPanel key={`${user.id}:${ticketId}`} ticketId={ticketId} actorId={user.id} role={role} />}
    </div>
  );
}

export default AdminSupport;
