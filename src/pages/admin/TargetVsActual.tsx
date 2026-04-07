import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BarChart3, TrendingUp, TrendingDown, Factory } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DeptStats {
  department: string;
  label: string;
  totalAssigned: number;
  totalProduced: number;
  totalWasted: number;
  activeJobs: number;
  completedJobs: number;
  efficiency: number;
}

const DEPT_LABELS: Record<string, string> = {
  arabic_sweets: "Arabic Sweets",
  bakery: "Bakery",
  chocolate: "Chocolate",
  dragees: "Dragees",
  fusion_sweets: "Fusion Sweets",
  nuts_mixes: "Nuts & Mixes",
  packing_assembly: "Packing & Assembly",
};

export default function TargetVsActual() {
  const [stats, setStats] = useState<DeptStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month">("today");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let since: string;
    if (dateRange === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (dateRange === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      since = d.toISOString();
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      since = d.toISOString();
    }

    // Fetch production jobs
    const { data: jobs } = await supabase
      .from("production_jobs")
      .select("department, assigned_qty, produced_qty, wasted_qty, status, created_at")
      .gte("created_at", since);

    // Fetch daily logs
    const { data: logs } = await supabase
      .from("daily_production_logs")
      .select("department, produced_qty, wastage_qty, log_date")
      .gte("created_at", since);

    const deptMap: Record<string, DeptStats> = {};
    Object.keys(DEPT_LABELS).forEach((dept) => {
      deptMap[dept] = {
        department: dept,
        label: DEPT_LABELS[dept],
        totalAssigned: 0,
        totalProduced: 0,
        totalWasted: 0,
        activeJobs: 0,
        completedJobs: 0,
        efficiency: 0,
      };
    });

    (jobs || []).forEach((j: any) => {
      const d = deptMap[j.department];
      if (!d) return;
      d.totalAssigned += j.assigned_qty || 0;
      d.totalProduced += j.produced_qty || 0;
      d.totalWasted += j.wasted_qty || 0;
      if (j.status === "completed") d.completedJobs++;
      else if (["accepted", "in_production", "paused"].includes(j.status)) d.activeJobs++;
    });

    // Also add from daily logs
    (logs || []).forEach((l: any) => {
      const dept = (l.department || "").toLowerCase().replace(/\s+/g, "_");
      const d = deptMap[dept];
      if (!d) return;
      d.totalProduced += l.produced_qty || 0;
      d.totalWasted += l.wastage_qty || 0;
    });

    Object.values(deptMap).forEach((d) => {
      d.efficiency = d.totalAssigned > 0 ? Math.round((d.totalProduced / d.totalAssigned) * 100) : d.totalProduced > 0 ? 100 : 0;
    });

    setStats(Object.values(deptMap));
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const totalAssigned = stats.reduce((s, d) => s + d.totalAssigned, 0);
  const totalProduced = stats.reduce((s, d) => s + d.totalProduced, 0);
  const totalWasted = stats.reduce((s, d) => s + d.totalWasted, 0);
  const overallEfficiency = totalAssigned > 0 ? Math.round((totalProduced / totalAssigned) * 100) : 0;

  const chartData = stats.map((s) => ({
    name: s.label.split(" ")[0],
    Target: s.totalAssigned,
    Actual: s.totalProduced,
    Waste: s.totalWasted,
  }));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={22} /> Target vs Actual — Factory Efficiency
        </h1>
        <div className="flex gap-1">
          {(["today", "week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                dateRange === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-foreground">{totalAssigned.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Target</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-emerald-600">{totalProduced.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Produced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-red-600">{totalWasted.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Wasted</p>
          </CardContent>
        </Card>
        <Card className={overallEfficiency >= 90 ? "bg-emerald-500/10" : overallEfficiency >= 70 ? "bg-amber-500/10" : "bg-red-500/10"}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-foreground">{overallEfficiency}%</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Efficiency</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Department-wise Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Target" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Waste" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Department cards */}
      <div className="grid gap-3">
        {stats.map((dept) => (
          <Card key={dept.department} className="border-l-4" style={{
            borderLeftColor: dept.efficiency >= 90 ? "hsl(var(--chart-2))" : dept.efficiency >= 70 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))"
          }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Factory size={16} className="text-muted-foreground" />
                  <h3 className="font-bold text-sm text-foreground">{dept.label}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {dept.efficiency >= 90 ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
                  <span className={`text-sm font-black ${dept.efficiency >= 90 ? "text-emerald-600" : dept.efficiency >= 70 ? "text-amber-600" : "text-red-600"}`}>
                    {dept.efficiency}%
                  </span>
                </div>
              </div>
              <Progress value={dept.efficiency} className="h-2 mb-2" />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Target: <strong className="text-foreground">{dept.totalAssigned}</strong></span>
                <span>Produced: <strong className="text-emerald-600">{dept.totalProduced}</strong></span>
                <span>Wasted: <strong className="text-red-600">{dept.totalWasted}</strong></span>
                <span>Active: <Badge variant="outline" className="text-[10px] ml-1">{dept.activeJobs}</Badge></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
