import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Send, Layers, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BOMComponent {
  id: string;
  component_name: string | null;
  component_product_id: string | null;
  quantity_per_unit: number;
  source_department: string | null;
  component_product?: { name: string; image_url: string | null; sku: string | null } | null;
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
  totalNeeded: number;
  available: number;
  taskIds: string[];
}

const DEPT_MAP: Record<string, string> = {
  "arabic_sweets": "arabic_sweets",
  "arabic sweets": "arabic_sweets",
  "bakery": "bakery",
  "chocolate": "chocolate",
  "dragees": "dragees",
  "fusion_sweets": "fusion_sweets",
  "fusion sweets": "fusion_sweets",
  "nuts_mixes": "nuts_mixes",
  "nuts": "nuts_mixes",
  "packing_assembly": "packing_assembly",
  "3rd party": "3rd_party",
  "rgs": "rgs",
};

export default function BOMDemandEngine() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AssemblyTask[]>([]);
  const [bomMap, setBomMap] = useState<Record<string, BOMComponent[]>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Fetch assembly tasks
    const { data: taskData } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, product:products(name, image_url, sku)")
      .in("department", ["Packing & Assembly", "Assembly", "Hampers", "Gifts"])
      .in("production_status", ["pending", "in_progress", "partial_ready"])
      .order("production_status", { ascending: true });

    const typedTasks = (taskData as any[] || []) as AssemblyTask[];
    setTasks(typedTasks);

    // Fetch BOMs for all product_ids
    const productIds = [...new Set(typedTasks.map(t => t.product_id).filter(Boolean))] as string[];
    if (productIds.length > 0) {
      const { data: bomData } = await supabase
        .from("product_bom")
        .select("id, product_id, component_name, component_product_id, quantity_per_unit, source_department")
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
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calculate aggregated BOM requirements
  const requirements: BOMRequirement[] = [];
  const reqMap: Record<string, BOMRequirement> = {};

  tasks.forEach((task) => {
    const bom = bomMap[task.product_id || ""] || [];
    const pendingQty = task.quantity - (task.actual_packed_qty || 0);
    if (pendingQty <= 0) return;

    bom.forEach((comp) => {
      const key = comp.component_product_id || comp.component_name || comp.id;
      const totalNeeded = comp.quantity_per_unit * pendingQty;
      if (!reqMap[key]) {
        reqMap[key] = {
          componentName: comp.component_name || "Unknown Component",
          componentProductId: comp.component_product_id,
          sourceDepartment: comp.source_department || "RGS",
          totalNeeded: 0,
          available: stockMap[comp.component_product_id || ""] || 0,
          taskIds: [],
        };
      }
      reqMap[key].totalNeeded += totalNeeded;
      reqMap[key].taskIds.push(task.id);
    });
  });

  Object.values(reqMap).forEach((r) => requirements.push(r));
  requirements.sort((a, b) => (b.totalNeeded - b.available) - (a.totalNeeded - a.available));

  const rgsItems = requirements.filter(r => {
    const dept = (r.sourceDepartment || "").toLowerCase();
    return !dept.includes("3rd") && !dept.includes("third");
  });
  const thirdPartyItems = requirements.filter(r => {
    const dept = (r.sourceDepartment || "").toLowerCase();
    return dept.includes("3rd") || dept.includes("third");
  });

  const handleRaiseDemand = async (items: BOMRequirement[], target: "RGS" | "3PCS") => {
    setActing(target);
    const shortfalls = items.filter(i => i.totalNeeded > i.available);
    if (shortfalls.length === 0) {
      toast.info("All components are available in stock!");
      setActing(null);
      return;
    }

    for (const item of shortfalls) {
      const shortfall = item.totalNeeded - item.available;
      if (target === "RGS" && item.componentProductId) {
        // Create production job via RGS path
        const dept = DEPT_MAP[(item.sourceDepartment || "").toLowerCase()] || "arabic_sweets";
        // Auto-priority: RED if completely out of stock, URGENT otherwise
        const stockLevel = item.available;
        const autoPriority = stockLevel === 0 ? "red" : "urgent";
        await supabase.from("production_jobs").insert({
          product_id: item.componentProductId,
          department: dept,
          assigned_qty: Math.ceil(shortfall),
          priority: autoPriority,
          status: "pending",
          stage: "prep",
        });
      }
      // Log demand
      await supabase.from("audit_logs").insert({
        action_type: "ASSEMBLY_DEMAND",
        module_name: "Assembly",
        entity_name: target === "RGS" ? "production_jobs" : "3pcs_demand",
        entity_id: item.componentProductId || "manual",
        actor_id: user?.id || null,
        new_value: {
          component: item.componentName,
          needed: Math.ceil(shortfall),
          target,
          source_department: item.sourceDepartment,
        } as any,
        risk_level: "high",
      });
    }

    toast.success(`🚨 ${shortfalls.length} demand requests sent to ${target}`);
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
              return (
                <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg border ${shortfall > 0 ? "bg-red-500/5 border-red-400/30" : "bg-emerald-500/5 border-emerald-400/30"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{req.componentName}</p>
                    <p className="text-[10px] text-muted-foreground">{req.sourceDepartment}</p>
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
          onClick={() => handleRaiseDemand(rgsItems, "RGS")}
          disabled={acting === "RGS"}
        >
          {acting === "RGS" ? <Loader2 size={14} className="animate-spin" /> : <><Store size={14} className="mr-1" /> Raise Demand to RGS</>}
        </Button>
        <Button
          className="flex-1 text-xs"
          variant="outline"
          onClick={() => handleRaiseDemand(thirdPartyItems, "3PCS")}
          disabled={acting === "3PCS"}
        >
          {acting === "3PCS" ? <Loader2 size={14} className="animate-spin" /> : <><Truck size={14} className="mr-1" /> Raise Demand to 3PCS</>}
        </Button>
      </div>
    </div>
  );
}
