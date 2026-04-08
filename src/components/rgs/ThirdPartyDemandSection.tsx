import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isActiveProductionStatus, isThirdPartyDepartment, isThirdPartyItem } from "@/lib/third-party";

interface AssemblyTask {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
}

interface BOMComponent {
  id: string;
  product_id: string;
  component_name: string | null;
  component_product_id: string | null;
  quantity_per_unit: number;
  source_department: string | null;
  component_product?: {
    name: string;
    image_url: string | null;
    sku: string | null;
    production_department: string | null;
  } | null;
}

interface ThirdPartyDemand {
  id: string;
  jobId: string | null;
  componentName: string;
  componentProductId: string | null;
  needed: number;
  sourceOrderIds: string[];
  createdAt: string | null;
  department: string;
  priority: "urgent" | "red";
}

export default function ThirdPartyDemandSection() {
  const { user } = useAuth();
  const [demands, setDemands] = useState<ThirdPartyDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatOrderRef = (orderId: string) => `SO#${orderId.slice(0, 8).toUpperCase()}`;

  const fetchDemands = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [jobResponse, assemblyResponse] = await Promise.all([
        supabase
          .from("production_jobs")
          .select("id, product_id, order_id, assigned_qty, priority, status, created_at, department, product:products(name, image_url, sku, production_department)")
          .in("status", ["pending", "accepted", "in_production", "paused"])
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("order_items")
          .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, department")
          .in("department", ["Packing & Assembly", "Assembly", "Hampers", "Gifts"])
          .in("production_status", ["pending", "accepted", "in_progress", "in_production", "partial_ready"])
          .limit(200),
      ]);

      if (jobResponse.error) throw jobResponse.error;
      if (assemblyResponse.error) throw assemblyResponse.error;

      const assemblyTasks = ((assemblyResponse.data as any[]) || []) as AssemblyTask[];
      const assemblyProductIds = [...new Set(assemblyTasks.map((task) => task.product_id).filter(Boolean))] as string[];

      let bomData: BOMComponent[] = [];
      if (assemblyProductIds.length > 0) {
        const bomResponse = await supabase
          .from("product_bom")
          .select("id, product_id, component_name, component_product_id, quantity_per_unit, source_department, component_product:products!product_bom_component_product_id_fkey(name, image_url, sku, production_department)")
          .in("product_id", assemblyProductIds);

        if (bomResponse.error) throw bomResponse.error;
        bomData = ((bomResponse.data as any[]) || []) as BOMComponent[];
      }

      const bomByProductId = new Map<string, BOMComponent[]>();
      bomData.forEach((component) => {
        const existing = bomByProductId.get(component.product_id) || [];
        existing.push(component);
        bomByProductId.set(component.product_id, existing);
      });

      const demandMap = new Map<string, ThirdPartyDemand>();

      (((jobResponse.data as any[]) || []) as any[])
        .filter((job) => isThirdPartyDepartment(job.department))
        .forEach((job) => {
          const key = job.product_id || job.id;
          demandMap.set(key, {
            id: key,
            jobId: job.id,
            componentName: job.product?.name || "Unnamed procurement item",
            componentProductId: job.product_id || null,
            needed: Number(job.assigned_qty) || 0,
            sourceOrderIds: job.order_id ? [job.order_id] : [],
            createdAt: job.created_at || null,
            department: job.department || "3rd Party",
            priority: job.priority === "red" ? "red" : "urgent",
          });
        });

      assemblyTasks.forEach((task) => {
        const pendingQty = task.quantity - (task.actual_packed_qty || 0);
        if (pendingQty <= 0 || !isActiveProductionStatus(task.production_status)) return;

        const bomItems = bomByProductId.get(task.product_id || "") || [];
        bomItems.forEach((component) => {
          const componentDept = component.component_product?.production_department || component.source_department;
          if (!isThirdPartyItem(component.source_department, componentDept)) return;

          const key = component.component_product_id || component.component_name || component.id;
          const existing = demandMap.get(key);
          const nextNeeded = Math.ceil(component.quantity_per_unit * pendingQty);
          const nextOrderIds = new Set([...(existing?.sourceOrderIds || []), ...(task.order_id ? [task.order_id] : [])]);

          demandMap.set(key, {
            id: key,
            jobId: existing?.jobId || null,
            componentName: component.component_product?.name || component.component_name || "Unnamed procurement item",
            componentProductId: component.component_product_id,
            needed: (existing?.needed || 0) + nextNeeded,
            sourceOrderIds: [...nextOrderIds],
            createdAt: existing?.createdAt || null,
            department: component.source_department || "3rd Party",
            priority: existing?.priority === "red" ? "red" : "urgent",
          });
        });
      });

      const nextDemands = [...demandMap.values()]
        .filter((demand) => demand.needed > 0)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority === "red" ? -1 : 1;
          return b.needed - a.needed;
        });

      setDemands(nextDemands);
    } catch (error) {
      console.error("[ThirdPartyDemandSection] Failed to load 3PCS demands", error);
      setDemands([]);
      setErrorMessage("No Procurement Tasks Active");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDemands(); }, [fetchDemands]);

  const handleHandover = async (demand: ThirdPartyDemand) => {
    setActing(demand.id);

    try {
      if (demand.jobId) {
        const { error: updateError } = await supabase
          .from("production_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", demand.jobId);

        if (updateError) throw updateError;
      }

      const { error: handoverError } = await supabase.from("audit_logs").insert({
        action_type: "3PCS_HANDOVER_ASSEMBLY",
        module_name: "3PCS",
        entity_name: "3pcs_procurement",
        entity_id: demand.componentProductId || demand.id,
        actor_id: user?.id || null,
        new_value: {
          component: demand.componentName,
          quantity: demand.needed,
          source_order_ids: demand.sourceOrderIds,
          handed_over_at: new Date().toISOString(),
        } as any,
        risk_level: "normal",
      });

      if (handoverError) throw handoverError;

      const { error: assemblyHandoverError } = await supabase.from("audit_logs").insert({
        action_type: "ASSEMBLY_HANDOVER",
        module_name: "3PCS",
        entity_name: "3pcs_procurement",
        entity_id: demand.componentProductId || demand.id,
        actor_id: user?.id || null,
        new_value: {
          component: demand.componentName,
          quantity: demand.needed,
          source: "3PCS",
          source_order_ids: demand.sourceOrderIds,
        } as any,
        risk_level: "normal",
      });

      if (assemblyHandoverError) throw assemblyHandoverError;

      toast.success(`✅ Handed over to Assembly: ${demand.componentName}`);
      fetchDemands();
    } catch (error: any) {
      toast.error(error?.message || "Failed to hand over procurement item");
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  if (errorMessage || demands.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
        {errorMessage || "No Procurement Tasks Active"}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex items-center gap-2">
          <Zap size={16} className="text-primary" />
          <p className="text-xs font-bold text-foreground">{demands.length} Urgent Assembly Support request{demands.length > 1 ? "s" : ""}</p>
        </CardContent>
      </Card>

      {demands.map((demand) => (
        <Card key={demand.id}>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                <Package size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{demand.componentName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {demand.sourceOrderIds.length > 0 ? demand.sourceOrderIds.map(formatOrderRef).join(", ") : "Awaiting order linkage"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={demand.priority === "red" ? "destructive" : "secondary"}>{demand.priority.toUpperCase()}</Badge>
                  <span className="text-[10px] text-muted-foreground">{demand.department}</span>
                  <span className="text-xs font-bold text-foreground ml-auto">Qty: {demand.needed}</span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-2 text-xs"
              variant="outline"
              onClick={() => handleHandover(demand)}
              disabled={acting === demand.id}
            >
              {acting === demand.id ? <Loader2 size={14} className="animate-spin" /> : (
                <><CheckCircle2 size={14} className="mr-1" /> Handover to Assembly <ArrowRight size={14} className="ml-1" /></>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
