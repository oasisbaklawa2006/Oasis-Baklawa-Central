import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopNavBar from "@/components/TopNavBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOrderItemDisplayName, resolveOrderItemFlow } from "@/lib/triad-order-items";
import { isActiveFactoryOrderStatus, isActiveProductionStatus } from "@/lib/third-party";
import { ArrowRight, CheckCircle2, Loader2, Package, RefreshCcw, Zap } from "lucide-react";
import { toast } from "sonner";

interface ThirdPartyStoreItem {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  task_type: string | null;
  notes: string | null;
  product?: {
    name: string | null;
    sku: string | null;
    image_url: string | null;
    production_department: string | null;
  } | null;
  order?: {
    status: string | null;
  } | null;
}

const formatOrderRef = (orderId: string) => `SO#${orderId.slice(0, 8).toUpperCase()}`;
const getPendingQty = (item: Pick<ThirdPartyStoreItem, "quantity" | "actual_packed_qty">) =>
  Math.max(0, item.quantity - (item.actual_packed_qty || 0));

export default function ThirdPartyStore() {
  const { user } = useAuth();
  const [items, setItems] = useState<ThirdPartyStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const initialFetchRef = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, quantity, actual_packed_qty, production_status, department, task_type, notes, product:products(name, sku, image_url, production_department), order:orders(status)",
        )
        .in("production_status", ["pending", "accepted", "in_progress", "in_production", "partial_ready"])
        .order("id", { ascending: false })
        .limit(50);

      if (error) throw error;
      setItems(((data as ThirdPartyStoreItem[]) ?? []).filter((item) => Boolean(item.id)));
    } catch (error) {
      console.error("[ThirdPartyStore] static fetch failed", error);
      setItems([]);
      setErrorMessage("Unable to load the 3PCS queue right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
    void fetchData();
  }, [fetchData]);

  const assemblySupportItems = useMemo(
    () =>
      items
        .filter((item) => item.task_type === "assembly_support")
        .filter((item) => resolveOrderItemFlow(item) === "FLOW_3PCS")
        .filter((item) => isActiveProductionStatus(item.production_status))
        .filter((item) => getPendingQty(item) > 0)
        .sort((a, b) => {
          const aPriority = a.notes?.includes("PRIORITY:red") ? 0 : 1;
          const bPriority = b.notes?.includes("PRIORITY:red") ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return getPendingQty(b) - getPendingQty(a);
        }),
    [items],
  );

  const procurementItems = useMemo(
    () =>
      items
        .filter((item) => item.task_type !== "assembly_support")
        .filter((item) => resolveOrderItemFlow(item) === "FLOW_3PCS")
        .filter((item) => isActiveProductionStatus(item.production_status))
        .filter((item) => isActiveFactoryOrderStatus(item.order?.status))
        .filter((item) => getPendingQty(item) > 0)
        .sort((a, b) => getPendingQty(b) - getPendingQty(a)),
    [items],
  );

  const handleHandover = useCallback(
    async (item: ThirdPartyStoreItem) => {
      setActingId(item.id);

      try {
        const pendingQty = getPendingQty(item);
        const { error: updateError } = await supabase
          .from("order_items")
          .update({ production_status: "completed", actual_packed_qty: pendingQty })
          .eq("id", item.id);

        if (updateError) throw updateError;

        await supabase.from("audit_logs").insert({
          action_type: "3PCS_HANDOVER_ASSEMBLY",
          module_name: "3PCS",
          entity_name: "3pcs_procurement",
          entity_id: item.product_id || item.id,
          actor_id: user?.id || null,
          new_value: {
            component: getOrderItemDisplayName(item),
            quantity: pendingQty,
            source_order_ids: item.order_id ? [item.order_id] : [],
            handed_over_at: new Date().toISOString(),
          } as any,
          risk_level: "normal",
        });

        setItems((prev) => prev.filter((entry) => entry.id !== item.id));
        toast.success(`Handed over to Assembly: ${getOrderItemDisplayName(item)}`);
      } catch (error: any) {
        toast.error(error?.message || "Failed to hand over procurement item");
      } finally {
        setActingId(null);
      }
    },
    [user?.id],
  );

  const renderEmptyState = (message: string) => (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-safe">
      <TopNavBar />
      <div className="pt-20 px-4 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">3rd Party Store (3PCS)</h1>
          <Badge variant="outline" className="text-xs">External Procurement</Badge>
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => void fetchData()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Refresh Snapshot
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="animate-spin text-primary" size={20} />
            <p className="text-xs text-muted-foreground">Loading 3PCS snapshot…</p>
          </div>
        ) : errorMessage ? (
          renderEmptyState(errorMessage)
        ) : (
        <Tabs defaultValue="assembly_support" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="assembly_support" className="flex-1">
              <Zap size={14} className="mr-1" /> Urgent Assembly Support
            </TabsTrigger>
            <TabsTrigger value="general" className="flex-1">
              <Package size={14} className="mr-1" /> General Procurement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assembly_support">
            {assemblySupportItems.length === 0 ? (
              renderEmptyState("No urgent assembly support requests.")
            ) : (
              <div className="space-y-3">
                {assemblySupportItems.map((item) => {
                  const pendingQty = getPendingQty(item);
                  const isPriorityRed = item.notes?.includes("PRIORITY:red");

                  return (
                    <Card key={item.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                            <Package size={16} className="text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{getOrderItemDisplayName(item)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.order_id ? formatOrderRef(item.order_id) : "Awaiting order linkage"}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <Badge variant={isPriorityRed ? "destructive" : "secondary"}>
                                {isPriorityRed ? "RED" : "URGENT"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{item.department || "3PCS"}</span>
                              <span className="ml-auto text-xs font-bold text-foreground">Qty: {pendingQty}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full text-xs"
                          onClick={() => void handleHandover(item)}
                          disabled={actingId === item.id}
                        >
                          {actingId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 size={14} className="mr-1" /> Handover to Assembly <ArrowRight size={14} className="ml-1" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="general">
            {procurementItems.length === 0 ? (
              renderEmptyState("No general procurement tasks active.")
            ) : (
              <div className="space-y-3">
                {procurementItems.map((item) => {
                  const pendingQty = getPendingQty(item);

                  return (
                    <Card key={item.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                            {item.product?.image_url ? (
                              <img
                                src={item.product.image_url}
                                alt={item.product.name || getOrderItemDisplayName(item)}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Package size={16} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{getOrderItemDisplayName(item)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.order_id ? formatOrderRef(item.order_id) : "No order linked"}
                              {item.product?.sku ? ` · SKU: ${item.product.sku}` : ""}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <Badge variant="outline">{item.department || "3rd Party"}</Badge>
                              <span className="ml-auto text-xs font-bold text-foreground">Qty: {pendingQty}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
        )}
      </div>
    </div>
  );
}
