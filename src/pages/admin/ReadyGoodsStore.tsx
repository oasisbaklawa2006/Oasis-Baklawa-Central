import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Inbox, Package, Factory, Barcode, CheckCircle2, AlertTriangle, Send, ScanLine, Printer, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StagnancyBadge from "@/components/StagnancyBadge";
import { Progress } from "@/components/ui/progress";

interface RGSOrderItem {
  id: string;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  product?: { name: string; sku: string | null; image_url: string | null; category?: { name: string } | null } | null;
}

interface RGSOrder {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  company?: { business_name: string } | null;
  items: RGSOrderItem[];
}

export default function ReadyGoodsStore() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<RGSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // Partial keypad state
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadItemId, setKeypadItemId] = useState<string | null>(null);
  const [keypadOrderId, setKeypadOrderId] = useState<string | null>(null);
  const [keypadValue, setKeypadValue] = useState("");
  const [keypadMax, setKeypadMax] = useState(0);
  const [keypadItemName, setKeypadItemName] = useState("");

  // Material Issue scan
  const [scanBarcode, setScanBarcode] = useState("");

  // Production Order form
  const [prodOrderType, setProdOrderType] = useState<"stock_buildup" | "live_requirement">("live_requirement");
  const [prodDept, setProdDept] = useState("Arabic Sweets");
  const [prodNotes, setProdNotes] = useState("");
  const [prodOrderItemId, setProdOrderItemId] = useState("");

  // Barcode label
  const [labelOrderId, setLabelOrderId] = useState("");
  const [labelInvoice, setLabelInvoice] = useState("");

  const FINISHED_GOODS_CATEGORIES = ["sweets", "nuts", "arabic", "chocolate", "bakery", "fusion", "seasoned", "dry fruit", "mithai"];

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, company:companies(business_name)")
      .in("status", ["in_production", "partial_ready", "approved"])
      .order("created_at", { ascending: true });

    const ordersWithItems: RGSOrder[] = [];
    for (const o of (data || [])) {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity, actual_packed_qty, production_status, department, product:products(name, sku, image_url, category:categories(name))")
        .eq("order_id", o.id);

      // Filter to only finished goods categories
      const filteredItems = ((items as any[]) || []).filter((item: any) => {
        const catName = (item.product?.category?.name || "").toLowerCase();
        const dept = (item.department || "").toLowerCase();
        return FINISHED_GOODS_CATEGORIES.some(c => catName.includes(c) || dept.includes(c)) || 
               dept.includes("ready goods") || dept === "" || !item.department;
      });

      if (filteredItems.length > 0) {
        ordersWithItems.push({ ...o, items: filteredItems } as RGSOrder);
      }
    }
    setOrders(ordersWithItems);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const markAvailability = async (orderId: string, status: "fully_available" | "partial" | "production_required") => {
    setActing(orderId);
    if (status === "fully_available") {
      const order = orders.find(o => o.id === orderId);
      for (const item of (order?.items || [])) {
        await supabase.from("order_items").update({ 
          production_status: "completed",
          actual_packed_qty: item.quantity 
        }).eq("id", item.id);
      }
      await supabase.from("orders").update({ status: "packed_ready" }).eq("id", orderId);
      toast.success("✅ All items marked available. Order → Packed Ready");
    } else if (status === "partial") {
      toast.info("Use the ⌨️ keypad on each item to enter available qty.");
    } else {
      await supabase.from("audit_logs").insert({
        action_type: "PRODUCTION_ORDER_REQUIRED",
        module_name: "RGS",
        entity_name: "orders",
        entity_id: orderId,
        actor_id: user?.id || null,
        new_value: { status: "production_required" },
        risk_level: "high",
      });
      toast.warning("🏭 Production Order flagged. Use 'Production Order' tab to dispatch.");
    }
    fetchOrders();
    setActing(null);
  };

  // Open partial keypad for a specific item
  const openPartialKeypad = (item: RGSOrderItem, orderId: string) => {
    setKeypadItemId(item.id);
    setKeypadOrderId(orderId);
    setKeypadMax(item.quantity);
    setKeypadValue("");
    setKeypadItemName(item.product?.name || "Unknown");
    setKeypadOpen(true);
  };

  // Submit partial qty — splits the line
  const submitPartialQty = async () => {
    if (!keypadItemId || !keypadOrderId) return;
    const availableQty = parseInt(keypadValue);
    if (isNaN(availableQty) || availableQty <= 0 || availableQty >= keypadMax) {
      toast.error(`Enter qty between 1 and ${keypadMax - 1}`);
      return;
    }
    setActing(keypadItemId);

    // Update existing item with available qty → "completed"
    await supabase.from("order_items").update({
      quantity: availableQty,
      actual_packed_qty: availableQty,
      production_status: "completed",
    }).eq("id", keypadItemId);

    // Get original item to copy fields
    const originalItem = orders.flatMap(o => o.items).find(i => i.id === keypadItemId);
    const remainingQty = keypadMax - availableQty;

    // Insert new line for remaining qty → "pending" (needs production)
    await supabase.from("order_items").insert({
      order_id: keypadOrderId,
      product_id: originalItem?.product ? undefined : null,
      quantity: remainingQty,
      actual_packed_qty: 0,
      production_status: "pending",
      department: originalItem?.department || null,
      notes: `Split from ${keypadItemId.slice(0, 8)} — needs production`,
    });

    // Also log the split for traceability
    await supabase.from("audit_logs").insert({
      action_type: "ORDER_LINE_SPLIT",
      module_name: "RGS",
      entity_name: "order_items",
      entity_id: keypadItemId,
      actor_id: user?.id || null,
      new_value: { available: availableQty, remaining: remainingQty, order_id: keypadOrderId },
      risk_level: "normal",
    });

    toast.success(`✅ ${availableQty} → Ready for Dispatch | ${remainingQty} → Needs Production`);
    setKeypadOpen(false);
    fetchOrders();
    setActing(null);
  };

  const handleKeypadPress = (digit: string) => {
    if (digit === "DEL") setKeypadValue(v => v.slice(0, -1));
    else if (digit === "CLR") setKeypadValue("");
    else setKeypadValue(v => v + digit);
  };

  const handleScanIssue = async () => {
    if (!scanBarcode.trim()) { toast.error("Scan or enter a barcode"); return; }
    setActing("scan");
    await supabase.from("audit_logs").insert({
      action_type: "MATERIAL_ISSUE",
      module_name: "RGS",
      entity_name: "dispatch_cartons",
      entity_id: scanBarcode,
      actor_id: user?.id || null,
      new_value: { barcode: scanBarcode, issued_at: new Date().toISOString() },
      risk_level: "normal",
    });
    toast.success(`📦 Material issued: ${scanBarcode}`);
    setScanBarcode("");
    setActing(null);
  };

  const submitProductionOrder = async () => {
    if (!prodOrderItemId.trim()) { toast.error("Enter an Order/Item ID"); return; }
    setActing("prod_order");
    await supabase.from("audit_logs").insert({
      action_type: "PRODUCTION_ORDER",
      module_name: "RGS",
      entity_name: "order_items",
      entity_id: prodOrderItemId,
      actor_id: user?.id || null,
      new_value: { type: prodOrderType, department: prodDept, notes: prodNotes },
      risk_level: "high",
    });
    toast.success(`🏭 ${prodOrderType === "stock_buildup" ? "Stock Build-Up" : "Live Requirement"} sent to ${prodDept}`);
    setProdOrderItemId("");
    setProdNotes("");
    setActing(null);
  };

  const generateLabel = () => {
    if (!labelOrderId || !labelInvoice) { toast.error("Enter Order ID and Invoice #"); return; }
    const zpl = `^XA
^FO30,30^A0N,40,40^FDPack 01 of 01^FS
^FO30,90^A0N,28,28^FDConsignee: [Client]^FS
^FO30,130^A0N,24,24^FDConsignor: TCF Chocolates & Gifts Pvt. Ltd.^FS
^FO30,165^A0N,20,20^FDWZ-117, Kirti Nagar, New Delhi-110015^FS
^FO30,210^BY3^BCN,100,Y,N,N^FD${labelOrderId}-${labelInvoice}^FS
^FO30,340^A0N,20,20^FDFSSAI: 10721042000284^FS
^XZ`;
    const blob = new Blob([zpl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `label-${labelOrderId.slice(0, 8)}.zpl`; a.click();
    URL.revokeObjectURL(url);
    toast.success("🏷️ ZPL Label downloaded");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Ready Goods Store (RGS)</h1>
        <Badge variant="outline">{orders.length} Orders in Queue</Badge>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="inbox"><Inbox size={14} className="mr-1" />Inbox</TabsTrigger>
          <TabsTrigger value="issue"><ScanLine size={14} className="mr-1" />Issue</TabsTrigger>
          <TabsTrigger value="prodorder"><Factory size={14} className="mr-1" />Prod Order</TabsTrigger>
          <TabsTrigger value="barcode"><Barcode size={14} className="mr-1" />Labels</TabsTrigger>
        </TabsList>

        {/* MODULE 1: INBOX */}
        <TabsContent value="inbox">
          {orders.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No orders in RGS queue.</CardContent></Card>
          )}
          <div className="grid gap-3">
            {orders.map(order => {
              const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
              const readyQty = order.items.reduce((s, i) => s + (i.production_status === "completed" ? (i.actual_packed_qty || i.quantity) : 0), 0);
              const progressPct = totalQty > 0 ? Math.round((readyQty / totalQty) * 100) : 0;

              return (
                <Card key={order.id} className="border-l-4 border-l-primary/60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm text-foreground">SO#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{order.company?.business_name || "N/A"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">₹{(order.sales_order_value || 0).toLocaleString()}</Badge>
                        <StagnancyBadge createdAt={order.created_at} />
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Readiness</span>
                        <span>{readyQty}/{totalQty} ({progressPct}%)</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                    </div>

                    {/* Item-level cards with individual partial keypad */}
                    <div className="space-y-2 mb-3">
                      {order.items.map(item => (
                        <div key={item.id} className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${item.production_status === "completed" ? "bg-emerald-500/10 border-emerald-400/40" : "bg-muted/50 border-border"}`}>
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {item.product?.image_url ? (
                              <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={14} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{item.product?.name?.slice(0, 25) || "?"}</p>
                            <p className="text-[10px] text-muted-foreground">Qty: {item.quantity} | Ready: {item.actual_packed_qty ?? 0}</p>
                          </div>
                          {item.production_status === "completed" ? (
                            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 border-emerald-400/40">✅</Badge>
                          ) : (
                            <Button size="sm" variant="outline" className="text-[10px] h-7 px-2" onClick={() => openPartialKeypad(item, order.id)}>
                              <Hash size={12} className="mr-1" />Qty
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 text-xs" onClick={() => markAvailability(order.id, "fully_available")} disabled={acting === order.id}>
                        <CheckCircle2 size={14} className="mr-1" /> Fully Available
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => markAvailability(order.id, "partial")} disabled={acting === order.id}>
                        <Package size={14} className="mr-1" /> Partial
                      </Button>
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => markAvailability(order.id, "production_required")} disabled={acting === order.id}>
                        <Factory size={14} className="mr-1" /> Need Prod
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* MODULE 2: MATERIAL ISSUE */}
        <TabsContent value="issue">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><ScanLine size={20} /> Scan-Based Material Issue</h2>
              <p className="text-xs text-muted-foreground">Scan barcode or enter ID to issue goods to Dispatch.</p>
              <Input value={scanBarcode} onChange={e => setScanBarcode(e.target.value)} placeholder="Scan or type barcode..." className="text-lg font-mono" onKeyDown={e => e.key === "Enter" && handleScanIssue()} />
              <Button className="w-full" onClick={handleScanIssue} disabled={acting === "scan"}>
                <Send size={16} className="mr-2" /> Issue to Dispatch
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MODULE 3: PRODUCTION ORDER */}
        <TabsContent value="prodorder">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Factory size={20} /> Production Order</h2>
              <div className="flex gap-2">
                <Button size="sm" variant={prodOrderType === "live_requirement" ? "default" : "outline"} onClick={() => setProdOrderType("live_requirement")}>Live Requirement</Button>
                <Button size="sm" variant={prodOrderType === "stock_buildup" ? "default" : "outline"} onClick={() => setProdOrderType("stock_buildup")}>Stock Build-Up</Button>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Target Department</label>
                <select value={prodDept} onChange={e => setProdDept(e.target.value)} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {["Arabic Sweets", "Bakery", "Chocolate", "Fusion Sweets", "Nuts Roasting", "Dragees", "3rd Party"].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Order/Item Reference</label>
                <Input value={prodOrderItemId} onChange={e => setProdOrderItemId(e.target.value)} placeholder="Order ID or Item ID" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Notes</label>
                <Input value={prodNotes} onChange={e => setProdNotes(e.target.value)} placeholder="Special instructions..." />
              </div>
              <Button className="w-full" onClick={submitProductionOrder} disabled={acting === "prod_order"}>
                <Send size={16} className="mr-2" /> Send Production Order
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MODULE 4: BARCODE LABELS */}
        <TabsContent value="barcode">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Barcode size={20} /> TSC TE 244 Label Generator</h2>
              <div>
                <label className="text-xs font-medium text-foreground">Order ID</label>
                <Input value={labelOrderId} onChange={e => setLabelOrderId(e.target.value)} placeholder="e.g. ECC8196F..." />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Tally Invoice #</label>
                <Input value={labelInvoice} onChange={e => setLabelInvoice(e.target.value)} placeholder="e.g. TCF/24-25/1234" />
              </div>
              <div className="bg-muted rounded-lg p-4 text-xs font-mono text-muted-foreground space-y-1">
                <p>Header: Pack 01 of 01</p>
                <p>Consignee: [Client Name]</p>
                <p>Consignor: TCF Chocolates & Gifts Pvt. Ltd.</p>
                <p>WZ-117, Kirti Nagar, New Delhi-110015</p>
                <p>Barcode: {labelOrderId || "___"}-{labelInvoice || "___"}</p>
                <p>FSSAI: 10721042000284</p>
              </div>
              <Button className="w-full" onClick={generateLabel}>
                <Printer size={16} className="mr-2" /> Download ZPL Label
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === NUMERIC KEYPAD MODAL === */}
      {keypadOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setKeypadOpen(false)}>
          <div className="bg-background rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1">Available Qty</h3>
            <p className="text-xs text-muted-foreground mb-1">{keypadItemName}</p>
            <p className="text-xs text-muted-foreground mb-4">Total Required: {keypadMax} — Enter what's available now.</p>

            <div className="bg-muted rounded-xl p-4 text-center mb-4">
              <span className="text-4xl font-mono font-bold text-foreground">{keypadValue || "0"}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1","2","3","4","5","6","7","8","9","CLR","0","DEL"].map(d => (
                <button key={d} onClick={() => handleKeypadPress(d)}
                  className={`py-3 rounded-xl font-bold text-lg transition-colors ${d === "CLR" || d === "DEL" ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
                  {d}
                </button>
              ))}
            </div>

            <div className="bg-amber-500/10 border border-amber-400/40 rounded-lg p-2 mb-4">
              <p className="text-[11px] text-amber-700 font-medium">
                ⚡ {keypadValue ? parseInt(keypadValue) : 0} → Ready for Dispatch | {keypadMax - (parseInt(keypadValue) || 0)} → Needs Production
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setKeypadOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={submitPartialQty} disabled={acting !== null}>
                <CheckCircle2 size={16} className="mr-1" /> Split & Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
