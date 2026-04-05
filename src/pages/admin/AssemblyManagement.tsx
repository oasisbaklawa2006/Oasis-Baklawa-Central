import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, AlertTriangle, Play, CheckCircle2, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StagnancyBadge from "@/components/StagnancyBadge";

interface AssemblyTask {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  pack_size: string | null;
  carton_type: string | null;
  notes: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
  order?: { id: string; created_at: string | null; company?: { business_name: string } | null } | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-700 border-amber-400/40",
  in_progress: "bg-blue-500/20 text-blue-700 border-blue-400/40",
  partial_ready: "bg-purple-500/20 text-purple-700 border-purple-400/40",
  completed: "bg-emerald-500/20 text-emerald-700 border-emerald-400/40",
};

export default function AssemblyManagement() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AssemblyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("order_items")
      .select("*, product:products(name, image_url, sku), order:orders(id, created_at, company:companies(business_name))")
      .in("department", ["Packing & Assembly", "Assembly", "Hampers", "Gifts"])
      .in("production_status", ["pending", "in_progress", "partial_ready"])
      .order("production_status", { ascending: true });
    setTasks((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

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

  const sendMaterialRequest = async (task: AssemblyTask) => {
    setActing(task.id);
    await supabase.from("audit_logs").insert({
      action_type: "MATERIAL_REQUEST",
      module_name: "Assembly",
      entity_name: "order_items",
      entity_id: task.id,
      actor_id: user?.id || null,
      new_value: { product: task.product?.name, qty: task.quantity, order_id: task.order_id },
      risk_level: "high",
    });
    toast.success("🚨 Material Request sent to RGS/3PGS");
    setActing(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Assembly Handheld</h1>
        <Badge variant="outline" className="text-xs">{tasks.length} Active Tasks</Badge>
      </div>

      {tasks.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No assembly tasks pending.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {tasks.map(task => (
          <Card key={task.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: task.production_status === "pending" ? "hsl(var(--chart-4))" : task.production_status === "in_progress" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))" }}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                {/* Product Photo */}
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {task.product?.image_url ? (
                    <img src={task.product.image_url} alt={task.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={24} className="text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{task.product?.name || "Unknown Product"}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">SKU: {task.product?.sku || "N/A"} · SO#{task.order_id?.slice(0, 8).toUpperCase()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-foreground">Qty: {task.quantity}</span>
                    <span className="text-[10px] text-muted-foreground">Ready: {task.actual_packed_qty ?? 0}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 border ${statusColor[task.production_status || "pending"]}`}>
                      {(task.production_status || "pending").replace("_", " ")}
                    </Badge>
                    <StagnancyBadge createdAt={task.order?.created_at || null} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                {task.production_status === "pending" && (
                  <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "in_progress")} disabled={acting === task.id}>
                    <Play size={14} className="mr-1" /> Start Work
                  </Button>
                )}
                {task.production_status === "in_progress" && (
                  <>
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "partial_ready")} disabled={acting === task.id}>
                      <Clock size={14} className="mr-1" /> Partial Ready
                    </Button>
                    <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "completed")} disabled={acting === task.id}>
                      <CheckCircle2 size={14} className="mr-1" /> Full Ready
                    </Button>
                  </>
                )}
                {task.production_status === "partial_ready" && (
                  <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "completed")} disabled={acting === task.id}>
                    <CheckCircle2 size={14} className="mr-1" /> Full Ready
                  </Button>
                )}
                <Button size="sm" variant="destructive" className="text-xs" onClick={() => sendMaterialRequest(task)} disabled={acting === task.id}>
                  <Send size={14} className="mr-1" /> Request Material
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
