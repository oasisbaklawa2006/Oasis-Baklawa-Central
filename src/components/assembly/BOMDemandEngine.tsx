import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Send, Layers, Store, Truck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { classifyFlow, mapToJobDept } from "@/utils/departmentClassifier";
import { withTimeout } from "@/lib/query-timeout";

interface BOMComponent {
  id: string;
  component_name: string | null;
  component_product_id: string | null;
  quantity_per_unit: number;
  source_department: string | null;
  component_product?: { name: string; image_url: string | null; sku: string | null; production_department: string | null } | null;
}

interface AssemblyTask {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
}

interface BOMRequirement {
  componentName: string;
  componentProductId: string | null;
  sourceDepartment: string;
  flow: "FLOW_FGS" | "FLOW_ASSEMBLY" | "FLOW_3PCS";
  totalNeeded: number;
  available: number;
  taskIds: string[];
  orderIds: string[];
  handedOver: boolean;
}

export default function BOMDemandEngine() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AssemblyTask[]>([]);
  const [bomMap, setBomMap] = useState<Record<string, BOMComponent[]>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [handoverMap, setHandoverMap] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    const { data: taskData } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, product:products(name, image_url, sku)")
      .in("department", ["Packing & Assembly", "Assembly", "Hampers", "Gifts"])
      .in("production_status", ["pending", "in_progress", "partial_ready"])
      .order("production_status", { ascending: true });

    const typedTasks = (taskData as any[] || []) as AssemblyTask[];
    setTasks(typedTasks);

    // Fetch BOMs with component product details
    const productIds = [...new Set(typedTasks.map(t => t.product_id).filter(Boolean))] as string[];
    if (productIds.length > 0) {
      const { data: bomData } = await supabase
        .from("product_bom")
        .select("id, product_id, component_name, component_product_id, quantity_per_unit, source_department, component_product:products!product_bom_component_product_id_fkey(name, image_url, sku, production_department)")
        .in("product_id", productIds);

      const map: Record<string, BOMComponent[]> = {};
      (bomData || []).forEach((b: any) => {
        if (!map[b.product_id]) map[b.product_id] = [];
        map[b.product_id].push(b);
      });
      setBomMap(map);
    }

    // Fetch stock
    const { data: inv } = await supabase.from("factory_inventory").select("product_id, quantity");
    const sm: Record<string, number> = {};
    (inv || []).forEach((r) => {
      if (r.product_id) sm[r.product_id] = (sm[r.product_id] || 0) + (Number(r.quantity) || 0);
    });
    setStockMap(sm);

    // Check handover status from audit_logs
    const { data: handovers } = await supabase
      .from("audit_logs")
      .select("entity_id")
      .eq("action_type", "ASSEMBLY_HANDOVER")
      .order("created_at", { ascending: false })
      .limit(200);
    
    const hm: Record<string, boolean> = {};
    (handovers || []).forEach((h: any) => {
      if (h.entity_id) hm[h.entity_id] = true;
    });
    setHandoverMap(hm);

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calculate aggregated BOM requirements with flow classification — MEMOIZED
  const { requirements } = React.useMemo(() => {
  const reqs: BOMRequirement[] = [];
  const reqMap: Record<string, BOMRequirement> = {};

  tasks.forEach((task) => {
    const bom = bomMap[task.product_id || ""] || [];
    const pendingQty = task.quantity - (task.actual_packed_qty || 0);
    if (pendingQty <= 0) return;

    bom.forEach((comp) => {
      const key = comp.component_product_id || comp.component_name || comp.id;
      if (comp.component_product_id && comp.component_product_id === task.product_id) return;
      const totalNeeded = comp.quantity_per_unit * pendingQty;
      
      // Use component's production_department for flow classification
      const compDept = comp.component_product?.production_department || comp.source_department;
      const flow = classifyFlow(compDept);

      if (!reqMap[key]) {
        reqMap[key] = {
          componentName: comp.component_product?.name || comp.component_name || "Unknown Component",
          componentProductId: comp.component_product_id,
          sourceDepartment: comp.source_department || "RGS",
          flow,
          totalNeeded: 0,
          available: stockMap[comp.component_product_id || ""] || 0,
          taskIds: [],
          orderIds: [],
          handedOver: handoverMap[comp.component_product_id || ""] || false,
        };
      }
      reqMap[key].totalNeeded += totalNeeded;
      if (!reqMap[key].taskIds.includes(task.id)) reqMap[key].taskIds.push(task.id);
      if (task.order_id && !reqMap[key].orderIds.includes(task.order_id)) reqMap[key].orderIds.push(task.order_id);
    });
  });

  Object.values(reqMap).forEach((r) => requirements.push(r));
  requirements.sort((a, b) => (b.totalNeeded - b.available) - (a.totalNeeded - a.available));

  const fgsItems = requirements.filter(r => r.flow === "FLOW_FGS");
  const thirdPartyItems = requirements.filter(r => r.flow === "FLOW_3PCS");

  const handleRaiseDemand = async (items: BOMRequirement[], target: "RGS" | "3PCS") => {
    setActing(target);
    const shortfalls = items.filter(i => i.totalNeeded > i.available);
    if (shortfalls.length === 0) {
      toast.info("All components are available in stock!");
      setActing(null);
      return;
    }

    let created = 0;
    for (const item of shortfalls) {
      const shortfall = Math.ceil(item.totalNeeded - item.available);
      const orderRef = item.orderIds[0] || "assembly";

      if (target === "RGS" && item.componentProductId) {
        const { data: existing } = await withTimeout(
          supabase
            .from("production_jobs")
            .select("id")
            .eq("product_id", item.componentProductId)
            .eq("order_id", orderRef)
            .in("status", ["pending", "accepted", "in_production", "paused"])
            .limit(1)
        );

        if (existing && existing.length > 0) continue;

        const dept = mapToJobDept(item.sourceDepartment);
        const stockLevel = item.available;
        const autoPriority = stockLevel === 0 ? "red" : "urgent";

        await withTimeout(supabase.from("production_jobs").insert({
          product_id: item.componentProductId,
          order_id: orderRef,
          department: dept,
          assigned_qty: shortfall,
          priority: autoPriority,
          status: "pending",
          stage: "prep",
        }));
        created++;
      }

      if (target === "3PCS") {
        const noteToken = `BOM_COMPONENT:${item.componentProductId || item.componentName}`;
        const { data: existing3PCSItem } = await withTimeout(
          supabase
            .from("order_items")
            .select("id")
            .eq("order_id", orderRef)
            .eq("task_type", "assembly_support")
            .eq("department", "3PCS")
            .ilike("notes", `%${noteToken}%`)
            .limit(1)
        );

        if (!existing3PCSItem || existing3PCSItem.length === 0) {
          await withTimeout(supabase.from("order_items").insert({
            order_id: orderRef,
            product_id: item.componentProductId,
            quantity: shortfall,
            production_status: "pending",
            department: "3PCS",
            task_type: "assembly_support",
            notes: `${noteToken} | Component: ${item.componentName} | Parent Flow: Assembly | PRIORITY:urgent`,
          }));
        }

        await withTimeout(supabase.from("audit_logs").insert({
          action_type: "ASSEMBLY_3PCS_DEMAND",
          module_name: "Assembly",
          entity_name: "order_items",
          entity_id: item.componentProductId || "manual",
          actor_id: user?.id || null,
          new_value: {
            component: item.componentName,
            component_product_id: item.componentProductId,
            needed: shortfall,
            source_department: item.sourceDepartment,
            source_order_ids: item.orderIds,
            priority: "urgent",
          } as any,
          risk_level: "high",
        }));
        created++;
      }

      await withTimeout(supabase.from("audit_logs").insert({
        action_type: "ASSEMBLY_DEMAND",
        module_name: "Assembly",
        entity_name: target === "RGS" ? "production_jobs" : "order_items",
        entity_id: item.componentProductId || "manual",
        actor_id: user?.id || null,
        new_value: {
          component: item.componentName,
          needed: shortfall,
          target,
          source_department: item.sourceDepartment,
          source_order_ids: item.orderIds,
        } as any,
        risk_level: "high",
      }));
    }

    toast.success(`🚨 ${created} demand requests sent to ${target}`);
    fetchData();
    setActing(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  if (tasks.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Layers size={32} className="mx-auto mb-2 opacity-40" />
        No active assembly tasks with BOM requirements.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-2">
            <Layers size={16} /> Auto-Calculated BOM Requirements
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {requirements.length} components needed across {tasks.length} assembly tasks
          </p>

          {requirements.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No BOM data found. Add BOMs to products in the Catalogue Builder.</p>
          )}

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {requirements.map((req, i) => {
              const shortfall = req.totalNeeded - req.available;
              const flowLabel = req.flow === "FLOW_FGS" ? "Food → RGS" : req.flow === "FLOW_3PCS" ? "Packing → 3PCS" : "Assembly";
              const flowColor = req.flow === "FLOW_FGS" ? "bg-blue-500/20 text-blue-700 border-blue-400/40" : req.flow === "FLOW_3PCS" ? "bg-purple-500/20 text-purple-700 border-purple-400/40" : "bg-amber-500/20 text-amber-700 border-amber-400/40";
              return (
                <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg border ${shortfall > 0 ? "bg-red-500/5 border-red-400/30" : "bg-emerald-500/5 border-emerald-400/30"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="font-medium text-foreground truncate">{req.componentName}</p>
                      {req.handedOver && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge className={`text-[8px] px-1 py-0 border ${flowColor}`}>{flowLabel}</Badge>
                      <span className="text-[10px] text-muted-foreground">{req.sourceDepartment}</span>
                      {req.handedOver && <span className="text-[9px] text-emerald-600 font-bold">Material Received</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-bold text-foreground">{Math.ceil(req.totalNeeded)}</p>
                    <p className={`text-[10px] font-bold ${shortfall > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {shortfall > 0 ? `↓${Math.ceil(shortfall)} short` : "✓ OK"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1 text-xs"
          variant="default"
          onClick={() => handleRaiseDemand(fgsItems, "RGS")}
          disabled={acting === "RGS" || fgsItems.length === 0}
        >
          {acting === "RGS" ? <Loader2 size={14} className="animate-spin" /> : <><Store size={14} className="mr-1" /> Raise Demand to RGS ({fgsItems.filter(i => i.totalNeeded > i.available).length})</>}
        </Button>
        <Button
          className="flex-1 text-xs"
          variant="outline"
          onClick={() => handleRaiseDemand(thirdPartyItems, "3PCS")}
          disabled={acting === "3PCS" || thirdPartyItems.length === 0}
        >
          {acting === "3PCS" ? <Loader2 size={14} className="animate-spin" /> : <><Truck size={14} className="mr-1" /> Raise Demand to 3PCS ({thirdPartyItems.filter(i => i.totalNeeded > i.available).length})</>}
        </Button>
      </div>
    </div>
  );
}
