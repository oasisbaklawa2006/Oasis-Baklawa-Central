import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, ScanLine, Camera, CheckCircle2, Printer, Box, Upload, Hash } from "lucide-react";
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

    await supabase.from("audit_logs").insert({
      action_type: "CARTON_CLOSED",
      module_name: "Dispatch",
      entity_name: "dispatch_cartons",
      entity_id: cartonId,
      actor_id: user?.id || null,
      new_value: { order_id: activeOrderId, items: currentCarton, photo_url: photoUrl },
      risk_level: "normal",
    });

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

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Dispatch Handheld</h1>
        <Badge variant="outline">{orders.length} Active Orders</Badge>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="dashboard" className="flex-1">Dashboard</TabsTrigger>
          <TabsTrigger value="packing" className="flex-1">Scan & Pack</TabsTrigger>
        </TabsList>

        {/* SCREEN 1: Dashboard */}
        <TabsContent value="dashboard">
          <div className="grid gap-3">
            {orders.map(order => {
              const pct = getReadiness(order);
              return (
                <Card key={order.id} className="border-l-4" style={{ borderLeftColor: pct === 100 ? "hsl(var(--chart-2))" : pct > 50 ? "hsl(var(--chart-4))" : "hsl(var(--chart-5))" }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm text-foreground">SO#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{order.company?.business_name || "N/A"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pct === 100 ? "default" : "outline"} className="text-[10px]">{pct}% Ready</Badge>
                        <StagnancyBadge createdAt={order.created_at} />
                      </div>
                    </div>
                    <Progress value={pct} className="h-2 mb-2" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 text-xs" onClick={() => { setActiveOrderId(order.id); setCartonCount(0); setCurrentCarton([]); }}>
                        <ScanLine size={14} className="mr-1" /> Start Packing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* SCREEN 2: Scan & Pack */}
        <TabsContent value="packing">
          {!activeOrderId ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Select an order from Dashboard first.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <p className="font-bold text-sm text-foreground mb-1">Packing: SO#{activeOrderId.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground mb-3">{activeOrder?.company?.business_name}</p>

                  {/* Scan Input */}
                  <form onSubmit={handleScan} className="flex gap-2 mb-3">
                    <Input ref={scanRef} value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="Scan barcode / Enter SKU..." className="flex-1" autoFocus />
                    <Button type="submit" size="sm"><ScanLine size={14} /></Button>
                  </form>

                  {/* Matched Item */}
                  {matchedItem && (
                    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {matchedItem.product?.image_url ? <img src={matchedItem.product.image_url} className="w-full h-full object-cover" /> : <Package size={16} className="text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{matchedItem.product?.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">SKU: {matchedItem.product?.sku} | Ordered: {matchedItem.quantity}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input type="number" value={packQty} onChange={e => setPackQty(e.target.value)} placeholder="Packed Qty" className="w-28" />
                        <Button size="sm" onClick={addToCarton}><Box size={14} className="mr-1" /> Add to Carton</Button>
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
                  <div className="flex gap-2 mb-3">
                    <label className="flex-1">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                      <Button variant="outline" size="sm" className="w-full text-xs" asChild><span><Camera size={14} className="mr-1" /> Photo Proof</span></Button>
                    </label>
                    {photoUrl && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700">✅ Photo Attached</Badge>}
                  </div>

                  {/* Close Carton */}
                  <Button className="w-full" onClick={closeCarton} disabled={acting || currentCarton.length === 0}>
                    <Printer size={16} className="mr-2" /> Close Carton & Print Label
                  </Button>
                </CardContent>
              </Card>

              {/* Order Items Summary */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-foreground mb-2">Order Items Status</p>
                  {activeOrder?.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {item.product?.image_url ? <img src={item.product.image_url} className="w-full h-full object-cover" /> : <Package size={12} className="text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{item.product?.name}</p>
                        <p className="text-[10px] text-muted-foreground">Packed: {item.actual_packed_qty || 0}/{item.quantity}</p>
                      </div>
                      {(item.actual_packed_qty || 0) >= item.quantity ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{Math.round(((item.actual_packed_qty || 0) / item.quantity) * 100)}%</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
