import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ThirdPartyDemand {
  id: string;
  entity_id: string | null;
  component: string;
  componentProductId: string | null;
  needed: number;
  sourceOrderIds: string[];
  createdAt: string;
}

export default function ThirdPartyDemandSection() {
  const { user } = useAuth();
  const [demands, setDemands] = useState<ThirdPartyDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchDemands = useCallback(async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("id, entity_id, new_value, created_at")
      .eq("action_type", "ASSEMBLY_3PCS_DEMAND")
      .order("created_at", { ascending: false })
      .limit(100);

    // Check which have been handed over
    const { data: handovers } = await supabase
      .from("audit_logs")
      .select("entity_id")
      .eq("action_type", "3PCS_HANDOVER_ASSEMBLY")
      .limit(200);
    
    const handedOver = new Set((handovers || []).map((h: any) => h.entity_id));

    const items: ThirdPartyDemand[] = ((data as any[]) || [])
      .filter((d: any) => !handedOver.has(d.entity_id))
      .map((d: any) => ({
        id: d.id,
        entity_id: d.entity_id,
        component: d.new_value?.component || "Unknown",
        componentProductId: d.new_value?.component_product_id || null,
        needed: d.new_value?.needed || 0,
        sourceOrderIds: d.new_value?.source_order_ids || [],
        createdAt: d.created_at,
      }));

    setDemands(items);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDemands(); }, [fetchDemands]);

  const handleHandover = async (demand: ThirdPartyDemand) => {
    setActing(demand.id);

    await supabase.from("audit_logs").insert({
      action_type: "3PCS_HANDOVER_ASSEMBLY",
      module_name: "3PCS",
      entity_name: "3pcs_procurement",
      entity_id: demand.entity_id || demand.id,
      actor_id: user?.id || null,
      new_value: {
        component: demand.component,
        quantity: demand.needed,
        source_order_ids: demand.sourceOrderIds,
        handed_over_at: new Date().toISOString(),
      } as any,
      risk_level: "normal",
    });

    // Also log as ASSEMBLY_HANDOVER so BOM engine shows checkmark
    await supabase.from("audit_logs").insert({
      action_type: "ASSEMBLY_HANDOVER",
      module_name: "3PCS",
      entity_name: "3pcs_procurement",
      entity_id: demand.componentProductId || demand.entity_id || demand.id,
      actor_id: user?.id || null,
      new_value: {
        component: demand.component,
        quantity: demand.needed,
        source: "3PCS",
      } as any,
      risk_level: "normal",
    });

    toast.success(`✅ Handed over to Assembly: ${demand.component}`);
    fetchDemands();
    setActing(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  if (demands.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
        No urgent packing material demands from Assembly.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="bg-purple-500/5 border-purple-400/30">
        <CardContent className="p-3 flex items-center gap-2">
          <Zap size={16} className="text-purple-600" />
          <p className="text-xs text-purple-700 font-bold">{demands.length} Urgent Assembly Support request{demands.length > 1 ? "s" : ""}</p>
        </CardContent>
      </Card>

      {demands.map((demand) => (
        <Card key={demand.id} className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                <Package size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{demand.component}</p>
                <p className="text-[10px] text-muted-foreground">
                  {demand.sourceOrderIds.map(id => `SO#${id.slice(0, 8).toUpperCase()}`).join(", ")}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className="text-[9px] px-1 py-0 border bg-red-500/20 text-red-700 border-red-400/40">URGENT</Badge>
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
