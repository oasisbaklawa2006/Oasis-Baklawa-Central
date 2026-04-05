import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Inbox, Package, Factory, Barcode, CheckCircle2, AlertTriangle, Send, ScanLine, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StagnancyBadge from "@/components/StagnancyBadge";

interface RGSOrder {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  company?: { business_name: string } | null;
  items?: { id: string; quantity: number; production_status: string | null; product?: { name: string; sku: string | null; image_url: string | null } | null }[];
}

export default function ReadyGoodsStore() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<RGSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

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

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, company:companies(business_name)")
      .in("status", ["in_production", "partial_ready"])
      .order("created_at", { ascending: true });

    const ordersWithItems: RGSOrder[] = [];
    for (const o of (data || [])) {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity, production_status, product:products(name, sku, image_url)")
        .eq("order_id", o.id);
      ordersWithItems.push({ ...o, items: (items as any[]) || [] } as RGSOrder);
    }
    setOrders(ordersWithItems);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const markAvailability = async (orderId: string, status: "fully_available" | "partial" | "production_required") => {
    setActing(orderId);
    if (status === "fully_available") {
      await supabase.from("order_items").update({ production_status: "completed" }).eq("order_id", orderId);
      await supabase.from("orders").update({ status: "packed_ready" }).eq("id", orderId);
      toast.success("✅ All items marked available. Order → Packed Ready");
    } else if (status === "partial") {
      toast.info("Mark individual items from the task cards.");
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
            {orders.map(order => (
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
                  <div className="flex flex-wrap gap-1 mb-3">
                    {order.items?.map(item => (
                      <Badge key={item.id} variant="secondary" className="text-[10px]">
                        {item.product?.name?.slice(0, 20) || "?"} × {item.quantity}
                        {item.production_status === "completed" && " ✅"}
                      </Badge>
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
                      <Factory size={14} className="mr-1" /> Need Production
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
    </div>
  );
}
