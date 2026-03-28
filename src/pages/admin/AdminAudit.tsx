import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, ShieldAlert, Archive, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action_type: string | null;
  actor_id: string | null;
  module_name: string | null;
  entity_name: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  risk_level: string | null;
  created_at: string;
}

const HIGH_RISK_ACTIONS = [
  "wallet_credit_executed",
  "return_settlement_executed",
  "role_updated",
  "permission_changed",
  "credit_request_approved",
  "commission_rate_updated",
  "manual_wallet_update",
];

const isHighRisk = (log: AuditLog) =>
  log.risk_level === "high" ||
  HIGH_RISK_ACTIONS.some((a) => log.action_type?.includes(a));

const AdminAudit = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [archiving, setArchiving] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
    setLogs((data as AuditLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleArchiveOld = async () => {
    setArchiving(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffISO = cutoff.toISOString();

      // Fetch old logs
      const { data: oldLogs, error: fetchErr } = await supabase
        .from("audit_logs")
        .select("*")
        .lt("created_at", cutoffISO);

      if (fetchErr) throw fetchErr;
      if (!oldLogs || oldLogs.length === 0) {
        toast.info("No logs older than 90 days to archive.");
        setArchiving(false);
        return;
      }

      // Insert into archive_logs
      const archiveRows = oldLogs.map((l: any) => ({
        id: l.id,
        action_type: l.action_type,
        actor_id: l.actor_id,
        module_name: l.module_name,
        entity_name: l.entity_name,
        entity_id: l.entity_id,
        old_value: l.old_value,
        new_value: l.new_value,
        reason: l.reason,
        risk_level: l.risk_level,
        created_at: l.created_at,
      }));

      const { error: insertErr } = await supabase.from("archive_logs").insert(archiveRows);
      if (insertErr) throw insertErr;

      // Delete archived logs from main table
      const { error: deleteErr } = await supabase
        .from("audit_logs")
        .delete()
        .lt("created_at", cutoffISO);
      if (deleteErr) throw deleteErr;

      toast.success(`Archived ${oldLogs.length} log(s) older than 90 days.`);
      fetchLogs();
    } catch (err: any) {
      toast.error("Archive failed: " + (err?.message || "Unknown error"));
    }
    setArchiving(false);
  };

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (l.action_type?.toLowerCase().includes(s)) ||
      (l.module_name?.toLowerCase().includes(s)) ||
      (l.entity_name?.toLowerCase().includes(s)) ||
      (l.reason?.toLowerCase().includes(s))
    );
  });

  const highRiskLogs = filtered.filter(isHighRisk);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  const renderTable = (rows: AuditLog[], showRiskBadge = false) => (
    rows.length === 0 ? (
      <p className="text-ui-label text-muted-foreground py-8">No audit logs found.</p>
    ) : (
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Timestamp</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Module</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Reason</th>
                {showRiskBadge && <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Risk</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3 text-fine text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-ui-cell text-foreground">{l.action_type || "—"}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{l.module_name || "—"}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{l.entity_name || "—"}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground max-w-[200px] truncate">{l.reason || "—"}</td>
                  {showRiskBadge && (
                    <td className="px-4 py-3">
                      {isHighRisk(l) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 animate-pulse">
                          <ShieldAlert size={10} /> High Risk
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display-h2 text-foreground">Audit Trail</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={14} /> Refresh All
          </button>
          <button
            onClick={handleArchiveOld}
            disabled={archiving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            🧹 Archive Old Logs
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by action, module, entity…" className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Logs</TabsTrigger>
          <TabsTrigger value="high_risk" className="gap-1.5">
            <ShieldAlert size={14} className="text-red-500" />
            High Risk ({highRiskLogs.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">{renderTable(filtered)}</TabsContent>
        <TabsContent value="high_risk">{renderTable(highRiskLogs, true)}</TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAudit;
