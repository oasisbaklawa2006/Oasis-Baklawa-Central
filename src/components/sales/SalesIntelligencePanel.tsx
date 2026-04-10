import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { format, subDays } from "date-fns";

interface Manager {
  id: string;
  full_name: string | null;
  name: string | null;
}

export default function SalesIntelligencePanel() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [companyCounts, setCompanyCounts] = useState<Record<string, number>>({});
  const [interactionCounts, setInteractionCounts] = useState<Record<string, number>>({});
  const [followUpCounts, setFollowUpCounts] = useState<Record<string, { total: number; withFollowUp: number }>>({});
  const [overdueCounts, setOverdueCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Get all sales executives
      const { data: execs } = await supabase
        .from("users")
        .select("id, full_name, name")
        .in("role", ["sales_executive", "SALES_EXECUTIVE"]);
      const execList = execs || [];
      setManagers(execList);

      if (execList.length === 0) { setLoading(false); return; }

      const execIds = execList.map(e => e.id);

      // Count assigned companies per exec
      const { data: comps } = await supabase
        .from("companies")
        .select("id, account_manager_id")
        .eq("status", "approved")
        .in("account_manager_id", execIds);
      const cc: Record<string, number> = {};
      (comps || []).forEach(c => {
        if (c.account_manager_id) cc[c.account_manager_id] = (cc[c.account_manager_id] || 0) + 1;
      });
      setCompanyCounts(cc);

      // Count interactions in last 7 days per exec
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: ints } = await supabase
        .from("client_interactions")
        .select("id, executive_id, company_id, follow_up_date")
        .in("executive_id", execIds)
        .gte("created_at", sevenDaysAgo);
      const ic: Record<string, number> = {};
      (ints || []).forEach(i => {
        if (i.executive_id) ic[i.executive_id] = (ic[i.executive_id] || 0) + 1;
      });
      setInteractionCounts(ic);

      // CRM completeness: clients with follow-up date set (from all interactions)
      const { data: allInts } = await supabase
        .from("client_interactions")
        .select("company_id, follow_up_date, executive_id")
        .in("executive_id", execIds)
        .not("follow_up_date", "is", null);
      const fc: Record<string, { total: number; withFollowUp: number }> = {};
      execIds.forEach(eid => {
        fc[eid] = { total: cc[eid] || 0, withFollowUp: 0 };
      });
      const followUpClients = new Set<string>();
      (allInts || []).forEach(i => {
        if (i.executive_id && i.company_id) {
          const key = `${i.executive_id}_${i.company_id}`;
          if (!followUpClients.has(key)) {
            followUpClients.add(key);
            if (fc[i.executive_id]) fc[i.executive_id].withFollowUp++;
          }
        }
      });
      setFollowUpCounts(fc);

      // Overdue tasks per exec
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: tasks } = await supabase
        .from("crm_tasks")
        .select("id, sales_exec_id")
        .in("sales_exec_id", execIds)
        .eq("status", "pending")
        .lt("due_date", today);
      const oc: Record<string, number> = {};
      (tasks || []).forEach(t => {
        if (t.sales_exec_id) oc[t.sales_exec_id] = (oc[t.sales_exec_id] || 0) + 1;
      });
      setOverdueCounts(oc);

      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (managers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" /> Sales Discipline Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Executive</TableHead>
              <TableHead className="text-center">Clients</TableHead>
              <TableHead className="text-center">7-Day Logs</TableHead>
              <TableHead className="text-center">CRM %</TableHead>
              <TableHead className="text-center">Overdue Tasks</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map(m => {
              const clients = companyCounts[m.id] || 0;
              const logs = interactionCounts[m.id] || 0;
              const fc = followUpCounts[m.id] || { total: 0, withFollowUp: 0 };
              const crmPct = fc.total > 0 ? Math.round((fc.withFollowUp / fc.total) * 100) : 0;
              const overdue = overdueCounts[m.id] || 0;
              const isLazy = clients > 0 && logs === 0;

              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.full_name || m.name || m.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-center">{clients}</TableCell>
                  <TableCell className="text-center font-mono">{logs}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={crmPct >= 70 ? "default" : crmPct >= 40 ? "secondary" : "destructive"} className="text-xs">
                      {crmPct}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {overdue > 0 ? (
                      <Badge variant="destructive" className="text-xs">{overdue}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isLazy ? (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle size={10} /> Inactive
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-300">
                        <CheckCircle size={10} /> Active
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
