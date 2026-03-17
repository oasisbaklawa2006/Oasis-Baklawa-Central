import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  created_at: string;
}

const AdminAudit = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      setLogs((data as AuditLog[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

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

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">Audit Trail</h1>
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by action, module, entity…" className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-3 text-fine text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-ui-cell text-foreground">{l.action_type || "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{l.module_name || "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{l.entity_name || "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground max-w-[200px] truncate">{l.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAudit;
