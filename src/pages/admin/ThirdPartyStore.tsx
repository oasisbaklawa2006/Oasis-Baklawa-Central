import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import TopNavBar from "@/components/TopNavBar";
import { supabase } from "@/integrations/supabase/client";
import { threePgsOrderItemRpc } from "@/lib/threePgsOrderItemRpc";
import { canAccessThreePgsOperator } from "@/lib/threePgsAccess";
import { getRoleDestination } from "@/lib/auth-routing";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface QueueItem {
  id: string;
  order_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  notes: string | null;
  product?: { name: string | null; sku: string | null } | null;
}

/**
 * Narrow legacy order-item completion surface retained during R4 command-centre
 * reconciliation. It is no longer the STORE_3RD_PARTY landing route and is
 * restricted to 3PGS operators/management; canonical stock authority remains
 * server-side in Core.
 */
export default function ThirdPartyStore() {
  const { role } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const fetchGuard = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, order_id, quantity, actual_packed_qty, production_status, notes, product:products(name, sku)")
        .eq("department", "3PCS")
        .in("production_status", ["pending", "in_progress", "partial_ready", "completed"])
        .order("production_status", { ascending: true })
        .limit(50);

      if (error) throw error;
      setItems((data as QueueItem[]) ?? []);
    } catch (err: unknown) {
      console.error("[3PCS] fetch failed", err);
      toast.error("Failed to load 3PCS queue");
      setItems([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  const authorized = canAccessThreePgsOperator(role);

  useEffect(() => {
    if (!authorized || fetchGuard.current) return;
    fetchGuard.current = true;
    void fetchData();
  }, [authorized, fetchData]);

  if (!authorized) {
    return <Navigate to={getRoleDestination(role)} replace />;
  }

  const handleComplete = async (item: QueueItem) => {
    setActingId(item.id);
    try {
      const { error } = await threePgsOrderItemRpc.rpc("complete_3pgs_order_item", {
        p_order_item_id: item.id,
        p_actual_packed_qty: item.quantity,
      });
      if (error) throw new Error(error.message);

      setItems((prev) => prev.map((current) => current.id === item.id
        ? { ...current, production_status: "completed", actual_packed_qty: item.quantity }
        : current));
      toast.success(`Marked complete: ${item.product?.name || "Item"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-safe">
      <TopNavBar />
      <div className="pt-20 px-4 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">3rd Party Store (3PCS)</h1>
            <p className="text-xs text-muted-foreground">Legacy order-item completion · canonical 3PGS queue is Procurement Queue</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void fetchData()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>

        {!loaded && loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No 3PCS items found.</div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Packed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product?.name || "Unknown"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{item.product?.sku || "—"}</TableCell>
                    <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.actual_packed_qty ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={item.production_status === "completed" ? "default" : "secondary"}>
                        {item.production_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.production_status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => void handleComplete(item)}
                          disabled={actingId === item.id}
                        >
                          {actingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          <span className="ml-1">Done</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
