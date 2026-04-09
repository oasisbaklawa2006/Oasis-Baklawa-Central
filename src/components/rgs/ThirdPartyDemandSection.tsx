import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Zap, CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isActiveProductionStatus } from "@/lib/third-party";
import { getOrderItemDisplayName, resolveOrderItemFlow } from "@/lib/triad-order-items";

interface ThirdPartyDemand {
  id: string;
  itemId: string;
  componentName: string;
  componentProductId: string | null;
  needed: number;
  sourceOrderIds: string[];
  department: string;
  priority: "urgent" | "red";
}

export default function ThirdPartyDemandSection() {
  const { user } = useAuth();
  const [demands, setDemands] = useState<ThirdPartyDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const formatOrderRef = (orderId: string) => `SO#${orderId.slice(0, 8).toUpperCase()}`;

  const fetchDemands = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, department, task_type, notes, product:products(name, image_url, sku, production_department)")
        .in("production_status", ["pending", "accepted", "in_progress", "in_production", "partial_ready"])
        .order("id", { ascending: false })
        .limit(50);

      if (error) throw error;

      const nextDemands = ((data as any[]) || [])
        .filter((item) => item.task_type === "assembly_support")
        .filter((item) => resolveOrderItemFlow(item) === "FLOW_3PCS")
        .filter((item) => isActiveProductionStatus(item.production_status))
        .map((item: any) => ({
          id: item.id,
          itemId: item.id,
          componentName: getOrderItemDisplayName(item),
          componentProductId: item.product_id,
          needed: Math.max(0, item.quantity - (item.actual_packed_qty || 0)),
          sourceOrderIds: item.order_id ? [item.order_id] : [],
          department: item.department || "3PCS",
          priority: (item.notes?.includes("PRIORITY:red") ? "red" : "urgent") as "urgent" | "red",
        }))
        .filter((d) => d.needed > 0)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority === "red" ? -1 : 1;
          return b.needed - a.needed;
        });

      setDemands(nextDemands);
      setErrorMessage(null);
    } catch (error) {
      console.error("[ThirdPartyDemandSection] fetch failed", error);
      setDemands([]);
      setErrorMessage("No Procurement Tasks Active");
    } finally {
      setLoading(false);
    }
  }, []);

  // Single fetch on mount — no realtime, no re-renders
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchDemands();
  }, [fetchDemands]);

  const handleHandover = async (demand: ThirdPartyDemand) => {
    setActing(demand.id);
    try {
      const { error: updateError } = await supabase
        .from("order_items")
        .update({ production_status: "completed", actual_packed_qty: demand.needed })
        .eq("id", demand.itemId);

      if (updateError) throw updateError;

      await supabase.from("audit_logs").insert({
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

      toast.success(`✅ Handed over to Assembly: ${demand.componentName}`);
      setDemands((prev) => prev.filter((d) => d.id !== demand.id));
    } catch (error: any) {
      toast.error(error?.message || "Failed to hand over procurement item");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Loader2 className="animate-spin text-primary" size={20} />
        <p className="text-xs text-muted-foreground">Loading procurement tasks…</p>
      </div>
    );
  }

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
          <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => { setLoading(true); fetchedRef.current = false; void fetchDemands(); }}>
            Refresh
          </Button>
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
