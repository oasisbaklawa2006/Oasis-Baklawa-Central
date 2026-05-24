import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, ScanLine, Camera, CheckCircle2, Printer, Box, Upload, Hash, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import StagnancyBadge from "@/components/StagnancyBadge";

interface DispatchOrder {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  company?: { business_name: string } | null;
  items: { id: string; quantity: number; actual_packed_qty: number | null; production_status: string | null; product?: { name: string; sku: string | null; image_url: string | null } | null }[];
}

interface CartonItem {
  itemId: string;
  productName: string;
  sku: string | null;
  packedQty: number;
}

export default function DispatchManagement() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Scan & Pack state
  const [scanInput, setScanInput] = useState("");
  const [matchedItem, setMatchedItem] = useState<DispatchOrder["items"][0] | null>(null);
  const [packQty, setPackQty] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  // Carton state
  const [currentCarton, setCurrentCarton] = useState<CartonItem[]>([]);
  const [cartonCount, setCartonCount] = useState(0);
  const [acting, setActing] = useState(false);

  // Photo proof
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, company:companies(business_name)")
      .in("status", ["in_production", "partial_ready", "packed_ready", "approved"])
      .order("created_at", { ascending: true });

    const result: DispatchOrder[] = [];
    for (const o of (data || [])) {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity, actual_packed_qty, production_status, product:products(name, sku, image_url)")
        .eq("order_id", o.id);
      result.push({ ...o, items: (items as any[]) || [] } as DispatchOrder);
    }
    setOrders(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const activeOrder = orders.find(o => o.id === activeOrderId);

  const getReadiness = (order: DispatchOrder) => {
    const total = order.items.reduce((s, i) => s + i.quantity, 0);
    const ready = order.items.reduce((s, i) => s + (i.actual_packed_qty || 0), 0);
    return total > 0 ? Math.round((ready / total) * 100) : 0;
  };

  const isAllPacked = (order: DispatchOrder) => {
    return order.items.length > 0 && order.items.every(i => (i.actual_packed_qty || 0) >= i.quantity);
  };

  const [finalizingDpl, setFinalizingDpl] = useState(false);

  const handleFinalizeDpl = async (orderId: string) => {
    setFinalizingDpl(true);
    try {
      const { data: currentRow, error: fetchErr } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const priorStatus = currentRow?.status ?? orders.find((o) => o.id === orderId)?.status ?? null;

      // Align with canonical OrderManagement STATUS_FLOW payment stage.
      await supabase.from("orders").update({ status: "awaiting_final_payment" }).eq("id", orderId);
      // Use actual prior order status for accurate dispatch audit history.
      await supabase.from("order_status_history").insert({
        order_id: orderId,
        old_status: priorStatus,
        new_status: "awaiting_final_payment",
      });
      await supabase.from("audit_logs").insert({
        action_type: "DPL_FINALIZED",
        module_name: "Dispatch",
        entity_name: "orders",
        entity_id: orderId,
        actor_id: user?.id || null,
        new_value: { note: "DPL finalized with actual packed quantities. Quantities locked." } as any,
        risk_level: "normal",
      });
      toast.success("✅ DPL Finalized — Order moved to Awaiting Finance");
      fetchOrders();
      setActiveOrderId(null);
    } catch {
      toast.error("Failed to finalize DPL");
    }
    setFinalizingDpl(false);
  };

  // Scan handler
  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim().toLowerCase();
    if (!code || !activeOrder) return;
    const found = activeOrder.items.find(i =>
      (i.product?.sku || "").toLowerCase() === code ||
      i.id.toLowerCase().startsWith(code)
    );
    if (found) {
      setMatchedItem(found);
      setPackQty("");
      toast.success(`✅ SKU Matched: ${found.product?.name}`);
    } else {
      toast.error("❌ SKU not found in this order");
    }
    setScanInput("");
  };

  const addToCarton = () => {
    if (!matchedItem || !packQty) return;
    const qty = parseInt(packQty);
    if (isNaN(qty) || qty <= 0) { toast.error("Enter valid qty"); return; }
    setCurrentCarton(prev => [...prev, {
      itemId: matchedItem.id,
      productName: matchedItem.product?.name || "Unknown",
      sku: matchedItem.product?.sku || null,
      packedQty: qty,
    }]);
    setMatchedItem(null);
    setPackQty("");
    toast.success(`Added ${qty}x to carton`);
  };

  const closeCarton = async () => {
    if (!activeOrderId || currentCarton.length === 0) return;
    setActing(true);
    const newCartonNum = cartonCount + 1;
    const cartonId = `C-${activeOrderId.slice(0, 4).toUpperCase()}-${String(newCartonNum).padStart(2, "0")}`;

    await supabase.from("dispatch_cartons").insert({
      barcode_string: cartonId,
      order_id: activeOrderId,
      box_number: newCartonNum,
      total_boxes: newCartonNum,
      status: "labeled",
    });

    // Update packed quantities
    for (const ci of currentCarton) {
      const item = activeOrder?.items.find(i => i.id === ci.itemId);
      const newPacked = (item?.actual_packed_qty || 0) + ci.packedQty;
      await supabase.from("order_items").update({ actual_packed_qty: newPacked }).eq("id", ci.itemId);
    }

    await supabase.from("audit_logs").insert([{
      action_type: "CARTON_CLOSED",
      module_name: "Dispatch",
      entity_name: "dispatch_cartons",
      entity_id: cartonId,
      actor_id: user?.id || null,
      new_value: { order_id: activeOrderId, items: currentCarton.map(c => ({ ...c })), photo_url: photoUrl } as any,
      risk_level: "normal",
    }]);

    setCartonCount(newCartonNum);
    setCurrentCarton([]);
    setPhotoUrl(null);
    toast.success(`📦 Carton ${cartonId} sealed & labeled`);

    // Generate ZPL label download
    const company = activeOrder?.company?.business_name || "N/A";
    const zpl = `^XA
^FO30,30^A0N,36,36^FDPack ${String(newCartonNum).padStart(2, "0")} of ${newCartonNum}^FS
^FO30,80^A0N,28,28^FDConsignee: ${company}^FS
^FO30,120^A0N,20,20^FDConsignor: TCF Chocolates & Gifts Pvt. Ltd.^FS
^FO30,150^A0N,18,18^FDWZ-117, Kirti Nagar, New Delhi-110015^FS
^FO30,190^BY3^BCN,80,Y,N,N^FD${cartonId}^FS
^FO30,300^A0N,16,16^FDFSSAI: 10721042000284^FS
^XZ`;
    const blob = new Blob([zpl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${cartonId}.zpl`; a.click();
    URL.revokeObjectURL(url);

    fetchOrders();
    setActing(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrderId) return;
    const path = `dispatch-proof/${activeOrderId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
    setPhotoUrl(urlData.publicUrl);

    await supabase.from("order_attachments").insert({
      order_id: activeOrderId,
      file_url: urlData.publicUrl,
      attachment_type: "dispatch_proof",
    });
    toast.success("📸 Photo proof uploaded");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-2 py-8" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg min-w-0 space-y-4 px-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Dispatch Handheld</h1>
        <Badge variant="outline">{orders.length} Active Orders</Badge>
      </div>

      <Tabs defaultValue="dashboard" className="w-full min-w-0">
        <TabsList className="grid h-auto w-full min-h-11 grid-cols-2 gap-1 p-1">
          <TabsTrigger value="dashboard" className="min-h-10 touch-manipulation">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="packing" className="min-h-10 touch-manipulation">
            Scan & Pack
          </TabsTrigger>
        </TabsList>

        {/* SCREEN 1: Dashboard */}
        <TabsContent value="dashboard" className="mt-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-12 text-center text-muted-foreground" role="status">
                <Package className="mx-auto h-12 w-12 opacity-40" aria-hidden />
                <p className="text-sm font-medium text-foreground">No active packing orders</p>
                <p className="text-xs leading-relaxed">
                  Orders in production or packing stages will appear here. If you expected work, refresh after operations updates the queue.
                </p>
                <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => void fetchOrders()}>
                  Refresh
                </Button>
              </CardContent>
            </Card>
          ) : (
          <div className="grid gap-3">
            {orders.map(order => {
              const pct = getReadiness(order);
              return (
                <Card key={order.id} className="border-l-4" style={{ borderLeftColor: pct === 100 ? "hsl(var(--chart-2))" : pct > 50 ? "hsl(var(--chart-4))" : "hsl(var(--chart-5))" }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm text-foreground">SO#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs break-words text-muted-foreground">{order.company?.business_name || "N/A"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pct === 100 ? "default" : "outline"} className="text-[10px]">{pct}% Ready</Badge>
                        <StagnancyBadge createdAt={order.created_at} />
                      </div>
                    </div>
                    <Progress value={pct} className="h-2 mb-2" />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        size="sm"
                        className="min-h-11 flex-1 touch-manipulation text-xs"
                        onClick={() => { setActiveOrderId(order.id); setCartonCount(0); setCurrentCarton([]); }}
                        aria-label={`Start packing order ${order.id.slice(0, 8)}`}
                      >
                        <ScanLine size={14} className="mr-1 shrink-0" aria-hidden /> Start Packing
                      </Button>
                      {pct === 100 && (
                        <Button
                          size="sm"
                          variant="default"
                          className="min-h-11 touch-manipulation bg-emerald-600 text-xs hover:bg-emerald-700"
                          onClick={() => void handleFinalizeDpl(order.id)}
                          disabled={finalizingDpl}
                          aria-label={`Finalize dispatch packing list for order ${order.id.slice(0, 8)}`}
                        >
                          <FileCheck size={14} className="mr-1 shrink-0" aria-hidden /> Finalize DPL
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}
        </TabsContent>

        {/* SCREEN 2: Scan & Pack */}
        <TabsContent value="packing" className="mt-4">
          {!activeOrderId ? (
            <Card>
              <CardContent className="space-y-3 py-12 text-center text-muted-foreground" role="status">
                <ScanLine className="mx-auto h-10 w-10 opacity-40" aria-hidden />
                <p className="text-sm font-medium text-foreground">Select an order first</p>
                <p className="text-xs">Open the Dashboard tab, choose an order, then return here to scan and seal cartons.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex max-h-[min(100dvh,48rem)] flex-col gap-0">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pb-4">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-bold text-foreground">Packing: SO#{activeOrderId.slice(0, 8).toUpperCase()}</p>
                  <p className="break-words text-xs text-muted-foreground">{activeOrder?.company?.business_name}</p>

                  <form onSubmit={handleScan} className="mb-3 flex gap-2">
                    <Input
                      ref={scanRef}
                      value={scanInput}
                      onChange={e => setScanInput(e.target.value)}
                      placeholder="Scan barcode / Enter SKU..."
                      className="min-h-11 flex-1"
                      autoFocus
                      aria-label="Scan or type product SKU"
                    />
                    <Button type="submit" size="icon" className="h-11 w-11 shrink-0 touch-manipulation" aria-label="Submit scan">
                      <ScanLine size={18} aria-hidden />
                    </Button>
                  </form>

                  {/* Matched Item */}
                  {matchedItem && (
                    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {matchedItem.product?.image_url ? <img src={matchedItem.product.image_url} className="w-full h-full object-cover" /> : <Package size={16} className="text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="break-words text-sm font-semibold text-foreground">{matchedItem.product?.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">SKU: {matchedItem.product?.sku} | Ordered: {matchedItem.quantity}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          type="number"
                          value={packQty}
                          onChange={e => setPackQty(e.target.value)}
                          placeholder="Packed Qty"
                          className="min-h-11 w-full sm:w-32"
                          aria-label="Quantity to add to carton"
                        />
                        <Button type="button" size="sm" className="min-h-11 w-full touch-manipulation sm:w-auto" onClick={addToCarton}>
                          <Box size={14} className="mr-1 shrink-0" aria-hidden /> Add to Carton
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Current Carton Contents */}
                  {currentCarton.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 mb-3">
                      <p className="text-xs font-bold text-foreground mb-2">📦 Current Carton ({currentCarton.length} items)</p>
                      {currentCarton.map((ci, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-foreground py-1 border-b border-border last:border-0">
                          <span>{ci.productName}</span>
                          <span className="font-mono font-bold">{ci.packedQty} pcs</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Photo Proof */}
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                    <label className="flex-1">
                      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoUpload} />
                      <Button variant="outline" size="sm" className="min-h-11 w-full touch-manipulation text-xs" asChild>
                        <span className="inline-flex cursor-pointer items-center justify-center gap-2">
                          <Camera size={14} aria-hidden /> Photo Proof
                        </span>
                      </Button>
                    </label>
                    {photoUrl && <Badge className="min-h-11 items-center bg-emerald-500/20 px-3 text-[10px] text-emerald-700">Photo attached</Badge>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="mb-2 text-xs font-bold text-foreground">Order Items Status</p>
                  {activeOrder?.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 border-b border-border py-1.5 last:border-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package size={12} className="text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-xs font-medium text-foreground">{item.product?.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Packed: {item.actual_packed_qty || 0}/{item.quantity}
                        </p>
                      </div>
                      {(item.actual_packed_qty || 0) >= item.quantity ? (
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-500" aria-label="Line complete" />
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {Math.round(((item.actual_packed_qty || 0) / item.quantity) * 100)}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
              </div>

              <div className="sticky bottom-0 z-10 mt-2 space-y-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  className="min-h-12 w-full touch-manipulation"
                  onClick={() => void closeCarton()}
                  disabled={acting || currentCarton.length === 0}
                  aria-label="Close carton and print label"
                >
                  <Printer size={16} className="mr-2 shrink-0" aria-hidden /> Close Carton & Print Label
                </Button>
                {activeOrder && isAllPacked(activeOrder) && (
                  <Button
                    type="button"
                    className="min-h-12 w-full touch-manipulation bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => void handleFinalizeDpl(activeOrderId!)}
                    disabled={finalizingDpl}
                    aria-label="Finalize dispatch packing list and send to finance"
                  >
                    <FileCheck size={16} className="mr-2 shrink-0" aria-hidden />{" "}
                    {finalizingDpl ? "Finalizing..." : "Finalize DPL → Send to Finance"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
