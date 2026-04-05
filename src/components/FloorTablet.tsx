import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Play, CheckCircle2, Clock, AlertTriangle, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StagnancyBadge from "@/components/StagnancyBadge";

interface FloorTask {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
  order?: { id: string; created_at: string | null } | null;
}

interface FloorTabletProps {
  department: string;
  departmentFilter: string[];
  title: string;
}

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-700 border-amber-400/40",
  in_progress: "bg-blue-500/20 text-blue-700 border-blue-400/40",
  partial_ready: "bg-purple-500/20 text-purple-700 border-purple-400/40",
  completed: "bg-emerald-500/20 text-emerald-700 border-emerald-400/40",
};

export default function FloorTablet({ department, departmentFilter, title }: FloorTabletProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<FloorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [mode, setMode] = useState<"handheld" | "tv">("handheld");

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, department, product:products(name, image_url, sku), order:orders(id, created_at)")
      .in("department", departmentFilter)
      .in("production_status", ["pending", "in_progress", "partial_ready", "completed"])
      .order("production_status", { ascending: true });
    setTasks((data as any[]) || []);
    setLoading(false);
  }, [departmentFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Auto-refresh for TV mode
  useEffect(() => {
    if (mode !== "tv") return;
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [mode, fetchTasks]);

  const updateStatus = async (taskId: string, newStatus: string) => {
    setActing(taskId);
    const updateData: any = { production_status: newStatus };
    if (newStatus === "completed") {
      const task = tasks.find(t => t.id === taskId);
      updateData.actual_packed_qty = task?.quantity || 0;
    }
    await supabase.from("order_items").update(updateData).eq("id", taskId);
    toast.success(`Task → ${newStatus.replace("_", " ").toUpperCase()}`);
    fetchTasks();
    setActing(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  const pending = tasks.filter(t => t.production_status === "pending");
  const inProcess = tasks.filter(t => t.production_status === "in_progress" || t.production_status === "partial_ready");
  const ready = tasks.filter(t => t.production_status === "completed");

  const now = new Date();
  const panicTasks = tasks.filter(t => {
    if (!t.order?.created_at) return false;
    const age = (now.getTime() - new Date(t.order.created_at).getTime()) / 3600000;
    return age > 6 && t.production_status !== "completed";
  });

  // === TV MODE ===
  if (mode === "tv") {
    return (
      <div className="space-y-4 min-h-screen">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{title} — TV View</h1>
          <Button size="sm" variant="outline" onClick={() => setMode("handheld")}>
            <Package size={14} className="mr-1" /> Handheld
          </Button>
        </div>

        {panicTasks.length > 0 && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 animate-pulse">
            <h2 className="text-xl font-bold text-destructive flex items-center gap-2">
              <AlertTriangle size={24} /> 🚨 PANIC — {panicTasks.length} Stagnant Tasks (&gt;6h)
            </h2>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {panicTasks.map(t => (
                <div key={t.id} className="bg-destructive/20 rounded-lg p-3">
                  <p className="text-lg font-bold text-destructive">{t.product?.name?.slice(0, 25)}</p>
                  <p className="text-sm font-mono text-destructive/80">SO#{t.order_id?.slice(0, 8).toUpperCase()} · Qty: {t.quantity}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {/* PENDING */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
              <Clock size={20} className="text-amber-500" /> ⏳ PENDING ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map(t => (
                <Card key={t.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="p-3">
                    <p className="text-lg font-bold text-foreground">{t.product?.name?.slice(0, 30)}</p>
                    <p className="text-sm font-mono text-muted-foreground">SKU: {t.product?.sku || "N/A"} · Qty: {t.quantity}</p>
                    <StagnancyBadge createdAt={t.order?.created_at || null} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* IN PROCESS */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
              <Play size={20} className="text-blue-500" /> 🔧 IN PROCESS ({inProcess.length})
            </h2>
            <div className="space-y-2">
              {inProcess.map(t => (
                <Card key={t.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-3">
                    <p className="text-lg font-bold text-foreground">{t.product?.name?.slice(0, 30)}</p>
                    <p className="text-sm font-mono text-muted-foreground">Qty: {t.actual_packed_qty ?? 0}/{t.quantity}</p>
                    <StagnancyBadge createdAt={t.order?.created_at || null} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* READY */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-500" /> ✅ READY ({ready.length})
            </h2>
            <div className="space-y-2">
              {ready.map(t => (
                <Card key={t.id} className="border-l-4 border-l-emerald-500 animate-pulse">
                  <CardContent className="p-3">
                    <p className="text-lg font-bold text-foreground">{t.product?.name?.slice(0, 30)}</p>
                    <p className="text-sm font-mono text-muted-foreground">✅ {t.quantity} units ready</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === HANDHELD MODE ===
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <div className="flex gap-2">
          <Badge variant="outline">{tasks.filter(t => t.production_status !== "completed").length} Active</Badge>
          <Button size="sm" variant="outline" onClick={() => setMode("tv")}>
            <Monitor size={14} className="mr-1" /> TV Mode
          </Button>
        </div>
      </div>

      {tasks.filter(t => t.production_status !== "completed").length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks for {department}.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {tasks.filter(t => t.production_status !== "completed").map(task => (
          <Card key={task.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: task.production_status === "pending" ? "hsl(var(--chart-4))" : "hsl(var(--chart-1))" }}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {task.product?.image_url ? (
                    <img src={task.product.image_url} alt={task.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={24} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{task.product?.name || "Unknown"}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">SKU: {task.product?.sku || "N/A"} · SO#{task.order_id?.slice(0, 8).toUpperCase()}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-bold text-foreground">Qty: {task.quantity}</span>
                    <span className="text-[10px] text-muted-foreground">Ready: {task.actual_packed_qty ?? 0}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 border ${statusColor[task.production_status || "pending"]}`}>
                      {(task.production_status || "pending").replace("_", " ")}
                    </Badge>
                    <StagnancyBadge createdAt={task.order?.created_at || null} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                {task.production_status === "pending" && (
                  <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "in_progress")} disabled={acting === task.id}>
                    <Play size={14} className="mr-1" /> Start Work
                  </Button>
                )}
                {(task.production_status === "in_progress" || task.production_status === "partial_ready") && (
                  <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "completed")} disabled={acting === task.id}>
                    <CheckCircle2 size={14} className="mr-1" /> Mark Ready
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
