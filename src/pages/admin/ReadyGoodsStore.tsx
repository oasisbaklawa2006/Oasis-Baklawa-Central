import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Inbox, Package, Factory, Barcode, CheckCircle2, AlertTriangle, Send, ScanLine, Printer, Hash, Search, Zap, TrendingDown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import StagnancyBadge from "@/components/StagnancyBadge";
import { Progress } from "@/components/ui/progress";
import StockCheckEngine from "@/components/rgs/StockCheckEngine";
import DailyPlanningModule from "@/components/rgs/DailyPlanningModule";
import ProductionPlanningPanel from "@/components/rgs/ProductionPlanningPanel";
import InternalDemandSection from "@/components/rgs/InternalDemandSection";

interface RGSOrderItem {
  id: string;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  product_id: string | null;
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

// Production order entries (auto-generated from Need Production)
interface ProdOrderEntry {
  id: string;
  productName: string;
  sku: string | null;
  qty: number;
  orderId: string;
  department: string;
  createdAt: string;
}

// RGS uses classifyFlow for strict filtering
import { classifyFlow } from "@/utils/departmentClassifier";

export default function ReadyGoodsStore() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<RGSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [prodOrders, setProdOrders] = useState<ProdOrderEntry[]>([]);

  // Partial keypad state
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadItemId, setKeypadItemId] = useState<string | null>(null);
  const [keypadOrderId, setKeypadOrderId] = useState<string | null>(null);
  const [keypadValue, setKeypadValue] = useState("");
  const [keypadMax, setKeypadMax] = useState(0);
  const [keypadItemName, setKeypadItemName] = useState("");

  // Material Issue
  const [scanBarcode, setScanBarcode] = useState("");
  const [manualSku, setManualSku] = useState("");

  // Production Order form
  const [prodOrderType, setProdOrderType] = useState<"stock_buildup" | "live_requirement">("live_requirement");
  const [prodDept, setProdDept] = useState("Arabic Sweets");
  const [prodNotes, setProdNotes] = useState("");
  const [prodOrderItemId, setProdOrderItemId] = useState("");
  const [prodOrderQty, setProdOrderQty] = useState("");

  // Labels
  const [labelProduct, setLabelProduct] = useState("");
  const [labelSku, setLabelSku] = useState("");
  const [labelGrammage, setLabelGrammage] = useState("");
  const [labelBatchNo, setLabelBatchNo] = useState("");
  const [labelMfgDate, setLabelMfgDate] = useState("");
  const [labelOrderId, setLabelOrderId] = useState("");
  const [labelInvoice, setLabelInvoice] = useState("");

  const isRGSItem = (item: any) => {
    const prodDept = item.product?.production_department || item.department || "";
    return classifyFlow(prodDept) === "FLOW_FGS";
  };

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, company:companies(business_name)")
      .in("status", ["in_production", "manufacturing", "partial_ready", "approved"])
      .order("created_at", { ascending: true });

    const ordersWithItems: RGSOrder[] = [];
    for (const o of (data || [])) {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity, actual_packed_qty, production_status, department, product_id, product:products(name, sku, image_url, production_department, category:categories(name))")
        .eq("order_id", o.id);

      const filteredItems = ((items as any[]) || []).filter((item: any) => isRGSItem(item));

      if (filteredItems.length > 0) {
        ordersWithItems.push({ ...o, items: filteredItems } as RGSOrder);
      }
    }
    setOrders(ordersWithItems);
    setLoading(false);
  }, []);

  // Fetch prod orders from audit_logs
  const fetchProdOrders = useCallback(async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("id, entity_id, new_value, created_at")
      .eq("action_type", "PRODUCTION_ORDER_ITEM")
      .order("created_at", { ascending: false })
      .limit(100);
    
    const entries: ProdOrderEntry[] = ((data as any[]) || []).map(d => ({
      id: d.id,
      productName: d.new_value?.product_name || "Unknown",
      sku: d.new_value?.sku || null,
      qty: d.new_value?.qty || 0,
      orderId: d.new_value?.order_id || d.entity_id || "",
      department: d.new_value?.department || "RGS",
      createdAt: d.created_at,
    }));
    setProdOrders(entries);
  }, []);

  useEffect(() => { fetchOrders(); fetchProdOrders(); }, [fetchOrders, fetchProdOrders]);

  // FIXED: No line splitting. Use single row with actual_packed_qty as "ready" counter.
  const submitPartialQty = async () => {
    if (!keypadItemId || !keypadOrderId) return;
    const availableQty = parseInt(keypadValue);
    if (isNaN(availableQty) || availableQty <= 0 || availableQty > keypadMax) {
      toast.error(`Enter qty between 1 and ${keypadMax}`);
      return;
    }
    setActing(keypadItemId);

    // Single row update: actual_packed_qty = ready count, status = partial_ready
    const newStatus = availableQty >= keypadMax ? "completed" : "partial_ready";
    await supabase.from("order_items").update({
      actual_packed_qty: availableQty,
      production_status: newStatus,
    }).eq("id", keypadItemId);

    // If partial, auto-insert a prod order entry for the remainder
    if (newStatus === "partial_ready") {
      const item = orders.flatMap(o => o.items).find(i => i.id === keypadItemId);
      const remaining = keypadMax - availableQty;
      await supabase.from("audit_logs").insert([{
        action_type: "PRODUCTION_ORDER_ITEM",
        module_name: "RGS",
        entity_name: "order_items",
        entity_id: keypadItemId,
        actor_id: user?.id || null,
        new_value: {
          product_name: item?.product?.name || "Unknown",
          sku: item?.product?.sku || null,
          qty: remaining,
          order_id: keypadOrderId,
          department: item?.department || "RGS",
          type: "partial_remainder",
        } as any,
        risk_level: "normal",
      }]);
      toast.success(`✅ ${availableQty} Ready | ${remaining} → Production Order created`);
    } else {
      toast.success(`✅ All ${availableQty} marked Ready`);
    }

    setKeypadOpen(false);
    fetchOrders();
    fetchProdOrders();
    setActing(null);
  };

  const markAvailability = async (orderId: string, status: "fully_available" | "partial" | "production_required") => {
    setActing(orderId);
    if (status === "fully_available") {
      const order = orders.find(o => o.id === orderId);
      for (const item of (order?.items || [])) {
        await supabase.from("order_items").update({
          production_status: "completed",
          actual_packed_qty: item.quantity,
        }).eq("id", item.id);
      }
      await supabase.from("orders").update({ status: "packed_ready" }).eq("id", orderId);
      toast.success("✅ All items marked available. Order → Packed Ready");
    } else if (status === "partial") {
      toast.info("Use the ⌨️ keypad on each item to enter available qty.");
    } else {
      // Need Production: auto-insert prod order entries for ALL pending items
      const order = orders.find(o => o.id === orderId);
      for (const item of (order?.items || []).filter(i => i.production_status !== "completed")) {
        const pendingQty = item.quantity - (item.actual_packed_qty || 0);
        if (pendingQty > 0) {
          await supabase.from("audit_logs").insert([{
            action_type: "PRODUCTION_ORDER_ITEM",
            module_name: "RGS",
            entity_name: "order_items",
            entity_id: item.id,
            actor_id: user?.id || null,
            new_value: {
              product_name: item.product?.name || "Unknown",
              sku: item.product?.sku || null,
              qty: pendingQty,
              order_id: orderId,
              department: item.department || "RGS",
              type: "production_required",
            } as any,
            risk_level: "high",
          }]);
        }
      }
      toast.warning("🏭 Production Orders created for all pending items. See 'Prod Order' tab.");
      fetchProdOrders();
    }
    fetchOrders();
    setActing(null);
  };

  const openPartialKeypad = (item: RGSOrderItem, orderId: string) => {
    setKeypadItemId(item.id);
    setKeypadOrderId(orderId);
    setKeypadMax(item.quantity);
    setKeypadValue(String(item.actual_packed_qty || ""));
    setKeypadItemName(item.product?.name || "Unknown");
    setKeypadOpen(true);
  };

  const handleKeypadPress = (digit: string) => {
    if (digit === "DEL") setKeypadValue(v => v.slice(0, -1));
    else if (digit === "CLR") setKeypadValue("");
    else setKeypadValue(v => v + digit);
  };

  const handleScanIssue = async () => {
    const code = scanBarcode.trim() || manualSku.trim();
    if (!code) { toast.error("Scan barcode or enter SKU manually"); return; }
    setActing("scan");
    await supabase.from("audit_logs").insert([{
      action_type: "MATERIAL_ISSUE",
      module_name: "RGS",
      entity_name: "dispatch_cartons",
      entity_id: code,
      actor_id: user?.id || null,
      new_value: { barcode: scanBarcode, manual_sku: manualSku, issued_at: new Date().toISOString() } as any,
      risk_level: "normal",
    }]);
    toast.success(`📦 Material issued: ${code}`);
    setScanBarcode("");
    setManualSku("");
    setActing(null);
  };

  const submitProductionOrder = async () => {
    if (!prodOrderItemId.trim()) { toast.error("Enter an Order/Item ID"); return; }
    if (!prodOrderQty || parseInt(prodOrderQty) <= 0) { toast.error("Enter a valid requested quantity"); return; }
    setActing("prod_order");
    await supabase.from("audit_logs").insert([{
      action_type: "PRODUCTION_ORDER",
      module_name: "RGS",
      entity_name: "order_items",
      entity_id: prodOrderItemId,
      actor_id: user?.id || null,
      new_value: { type: prodOrderType, department: prodDept, notes: prodNotes, requested_qty: parseInt(prodOrderQty) } as any,
      risk_level: "high",
    }]);
    toast.success(`🏭 ${prodOrderType === "stock_buildup" ? "Stock Build-Up" : "Live Requirement"} — ${prodOrderQty} units sent to ${prodDept}`);
    setProdOrderItemId("");
    setProdOrderQty("");
    setProdNotes("");
    fetchProdOrders();
    setActing(null);
  };

  const generateLabel = () => {
    if (!labelProduct && !labelSku) { toast.error("Select a Product or enter SKU"); return; }
    const zpl = `^XA
^FO30,30^A0N,40,40^FDPack 01 of 01^FS
^FO30,90^A0N,28,28^FDProduct: ${labelProduct || labelSku}^FS
^FO30,130^A0N,24,24^FDSKU: ${labelSku}^FS
^FO30,170^A0N,24,24^FDGrammage: ${labelGrammage || "N/A"}^FS
^FO30,210^A0N,24,24^FDBatch: ${labelBatchNo || "N/A"} | Mfg: ${labelMfgDate || "N/A"}^FS
^FO30,260^A0N,24,24^FDConsignor: TCF Chocolates & Gifts Pvt. Ltd.^FS
^FO30,295^A0N,20,20^FDWZ-117, Kirti Nagar, New Delhi-110015^FS
^FO30,340^BY3^BCN,100,Y,N,N^FD${labelOrderId || labelSku}-${labelInvoice || labelBatchNo}^FS
^FO30,470^A0N,20,20^FDFSSAI: 10721042000284^FS
^XZ`;
    const blob = new Blob([zpl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `label-${(labelSku || labelProduct).slice(0, 15)}.zpl`; a.click();
    URL.revokeObjectURL(url);
    toast.success("🏷️ ZPL Label downloaded");
  };

  // Compute Live Summary for Prod Orders
  const skuSummary: Record<string, { name: string; sku: string | null; totalQty: number; orderCount: number }> = {};
  prodOrders.forEach(po => {
    const key = po.sku || po.productName;
    if (!skuSummary[key]) skuSummary[key] = { name: po.productName, sku: po.sku, totalQty: 0, orderCount: 0 };
    skuSummary[key].totalQty += po.qty;
    skuSummary[key].orderCount += 1;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Ready Goods Store (RGS)</h1>
        <Badge variant="outline">{orders.length} Orders in Queue</Badge>
      </div>

      <Tabs defaultValue="stockcheck" className="w-full">
        <TabsList className="w-full grid grid-cols-7">
          <TabsTrigger value="stockcheck"><Zap size={14} className="mr-1" />Stock Check</TabsTrigger>
          <TabsTrigger value="demand"><Bell size={14} className="mr-1" />Internal Demand</TabsTrigger>
          <TabsTrigger value="planning"><TrendingDown size={14} className="mr-1" />Planning</TabsTrigger>
          <TabsTrigger value="inbox"><Inbox size={14} className="mr-1" />Inbox</TabsTrigger>
          <TabsTrigger value="issue"><ScanLine size={14} className="mr-1" />Issue</TabsTrigger>
          <TabsTrigger value="prodorder"><Factory size={14} className="mr-1" />Buffer Order</TabsTrigger>
          <TabsTrigger value="barcode"><Barcode size={14} className="mr-1" />Labels</TabsTrigger>
        </TabsList>

        {/* MODULE 0: STOCK CHECK ENGINE */}
        <TabsContent value="stockcheck">
          <StockCheckEngine />
        </TabsContent>

        {/* MODULE: INTERNAL DEMAND FROM ASSEMBLY */}
        <TabsContent value="demand">
          <InternalDemandSection />
        </TabsContent>

        {/* MODULE: DAILY PLANNING */}
        <TabsContent value="planning">
          <DailyPlanningModule />
        </TabsContent>

        {/* MODULE 1: INBOX — Filtered to Baklava/Sweets/Nuts only */}
        <TabsContent value="inbox">
          {orders.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No orders in RGS queue.</CardContent></Card>
          )}
          <div className="grid gap-3">
            {orders.map(order => {
              const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
              const readyQty = order.items.reduce((s, i) => s + (i.actual_packed_qty || 0), 0);
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

                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Ready / Total</span>
                        <span>{readyQty}/{totalQty} ({progressPct}%)</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                    </div>

                    {/* Item cards — single row per item, no splitting */}
                    <div className="space-y-2 mb-3">
                      {order.items.map(item => {
                        const ready = item.actual_packed_qty || 0;
                        const pending = item.quantity - ready;
                        return (
                          <div key={item.id} className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${item.production_status === "completed" ? "bg-emerald-500/10 border-emerald-400/40" : item.production_status === "partial_ready" ? "bg-purple-500/10 border-purple-400/40" : "bg-muted/50 border-border"}`}>
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {item.product?.image_url ? (
                                <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package size={16} className="text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{item.product?.name || "Unknown Product"}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                SKU: {item.product?.sku || "N/A"} | Ready: <span className="text-emerald-600 font-bold">{ready}</span> / {item.quantity}
                                {pending > 0 && item.production_status !== "pending" && <span className="text-amber-600 ml-1">({pending} pending)</span>}
                              </p>
                            </div>
                            {item.production_status === "completed" ? (
                              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 border-emerald-400/40">✅ Done</Badge>
                            ) : (
                              <Button size="sm" variant="outline" className="text-[10px] h-7 px-2" onClick={() => openPartialKeypad(item, order.id)}>
                                <Hash size={12} className="mr-1" />Qty
                              </Button>
                            )}
                          </div>
                        );
                      })}
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

        {/* MODULE 2: MATERIAL ISSUE — with manual SKU fallback */}
        <TabsContent value="issue">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><ScanLine size={20} /> Scan-Based Material Issue</h2>
              <p className="text-xs text-muted-foreground">Scan barcode or enter SKU manually to issue goods to Dispatch.</p>
              <Input value={scanBarcode} onChange={e => setScanBarcode(e.target.value)} placeholder="📷 Scan barcode here..." className="text-lg font-mono" onKeyDown={e => e.key === "Enter" && handleScanIssue()} />
              <div className="flex items-center gap-2">
                <Search size={14} className="text-muted-foreground" />
                <Input value={manualSku} onChange={e => setManualSku(e.target.value)} placeholder="Manual SKU entry (if scanner fails)" className="text-sm" onKeyDown={e => e.key === "Enter" && handleScanIssue()} />
              </div>
              <Button className="w-full" onClick={handleScanIssue} disabled={acting === "scan"}>
                <Send size={16} className="mr-2" /> Issue to Dispatch
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MODULE 3: BUFFER STOCK ORDER — Production Planning Panel */}
        <TabsContent value="prodorder">
          <ProductionPlanningPanel />
        </TabsContent>

        {/* MODULE 4: LABELS — with Product/SKU dropdowns, Grammage, Batch, Mfg Date */}
        <TabsContent value="barcode">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Barcode size={20} /> TSC TE 244 Label Generator</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Product Name</label>
                  <Input value={labelProduct} onChange={e => setLabelProduct(e.target.value)} placeholder="e.g. Baklava Mix 500g" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">SKU</label>
                  <Input value={labelSku} onChange={e => setLabelSku(e.target.value)} placeholder="e.g. BKL-MIX-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Grammage</label>
                  <Input value={labelGrammage} onChange={e => setLabelGrammage(e.target.value)} placeholder="e.g. 500g" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Batch No</label>
                  <Input value={labelBatchNo} onChange={e => setLabelBatchNo(e.target.value)} placeholder="e.g. B2025-04-001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Mfg Date</label>
                  <Input type="date" value={labelMfgDate} onChange={e => setLabelMfgDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Order ID (optional)</label>
                  <Input value={labelOrderId} onChange={e => setLabelOrderId(e.target.value)} placeholder="e.g. ECC8196F" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Tally Invoice #</label>
                  <Input value={labelInvoice} onChange={e => setLabelInvoice(e.target.value)} placeholder="e.g. TCF/24-25/1234" />
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4 text-xs font-mono text-muted-foreground space-y-1">
                <p>Product: {labelProduct || labelSku || "___"}</p>
                <p>Grammage: {labelGrammage || "___"} | Batch: {labelBatchNo || "___"} | Mfg: {labelMfgDate || "___"}</p>
                <p>Consignor: TCF Chocolates & Gifts Pvt. Ltd., WZ-117, Kirti Nagar</p>
                <p>Barcode: {labelOrderId || labelSku || "___"}-{labelInvoice || labelBatchNo || "___"}</p>
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
            <p className="text-xs text-muted-foreground mb-4">Total Required: {keypadMax}</p>

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
                ⚡ {keypadValue ? parseInt(keypadValue) : 0} → Ready | {keypadMax - (parseInt(keypadValue) || 0)} → Need Production
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setKeypadOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={submitPartialQty} disabled={acting !== null}>
                <CheckCircle2 size={16} className="mr-1" /> Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
