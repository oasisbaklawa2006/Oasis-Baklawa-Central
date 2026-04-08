import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DemandJob {
  id: string;
  product_id: string | null;
  order_id: string | null;
  department: string;
  assigned_qty: number;
  priority: string;
  status: string;
  created_at: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
}

export default function InternalDemandSection() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<DemandJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchDemandJobs = useCallback(async () => {
    // Fetch URGENT/RED production_jobs — these are Assembly-raised demands
    const { data } = await supabase
      .from("production_jobs")
      .select("id, product_id, order_id, department, assigned_qty, priority, status, created_at, product:products(name, image_url, sku)")
      .in("priority", ["urgent", "red"])
      .in("status", ["pending", "accepted", "in_production"])
      .order("created_at", { ascending: true });

    setJobs((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDemandJobs(); }, [fetchDemandJobs]);

  const handleHandover = async (job: DemandJob) => {
    setActing(job.id);
    // Mark the production job as completed
    await supabase.from("production_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    // Log handover so Assembly sees "Material Received"
    await supabase.from("audit_logs").insert({
      action_type: "ASSEMBLY_HANDOVER",
      module_name: "RGS",
      entity_name: "production_jobs",
      entity_id: job.product_id || job.id,
      actor_id: user?.id || null,
      new_value: {
        job_id: job.id,
        product_id: job.product_id,
        quantity: job.assigned_qty,
        order_id: job.order_id,
        handed_over_at: new Date().toISOString(),
      } as any,
      risk_level: "normal",
    });

    toast.success(`✅ Handed over to Assembly: ${job.product?.name || "Item"}`);
    fetchDemandJobs();
    setActing(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  if (jobs.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
        No urgent Assembly demands pending.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="bg-red-500/5 border-red-400/30">
        <CardContent className="p-3 flex items-center gap-2">
          <Zap size={16} className="text-red-600" />
          <p className="text-xs text-red-700 font-bold">{jobs.length} URGENT demand{jobs.length > 1 ? "s" : ""} from Assembly</p>
        </CardContent>
      </Card>

      {jobs.map((job) => (
        <Card key={job.id} className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {job.product?.image_url ? (
                  <img src={job.product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package size={16} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{job.product?.name || "Unknown"}</p>
                <p className="text-[10px] text-muted-foreground">
                  SKU: {job.product?.sku || "N/A"} · SO#{(job.order_id || "").slice(0, 8).toUpperCase()}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className={`text-[9px] px-1 py-0 border ${job.priority === "red" ? "bg-red-500/20 text-red-700 border-red-400/40" : "bg-amber-500/20 text-amber-700 border-amber-400/40"}`}>
                    {job.priority.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{job.department}</span>
                  <span className="text-xs font-bold text-foreground ml-auto">Qty: {job.assigned_qty}</span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => handleHandover(job)}
              disabled={acting === job.id}
            >
              {acting === job.id ? <Loader2 size={14} className="animate-spin" /> : (
                <><CheckCircle2 size={14} className="mr-1" /> Handover to Assembly <ArrowRight size={14} className="ml-1" /></>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
