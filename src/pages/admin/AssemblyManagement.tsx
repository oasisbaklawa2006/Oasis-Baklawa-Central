import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Play, CheckCircle2, Clock, Send, Hash, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StagnancyBadge from "@/components/StagnancyBadge";

interface AssemblyTask {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  pack_size: string | null;
  carton_type: string | null;
  notes: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
  order?: { id: string; created_at: string | null; company?: { business_name: string } | null } | null;
}

interface ProductOption {
  id: string;
  name: string;
  image_url: string | null;
  sku: string | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-700 border-amber-400/40",
  in_progress: "bg-blue-500/20 text-blue-700 border-blue-400/40",
  partial_ready: "bg-purple-500/20 text-purple-700 border-purple-400/40",
  completed: "bg-emerald-500/20 text-emerald-700 border-emerald-400/40",
};

export default function AssemblyManagement() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AssemblyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // Numeric keypad modal state
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadTaskId, setKeypadTaskId] = useState<string | null>(null);
  const [keypadValue, setKeypadValue] = useState("");
  const [keypadMax, setKeypadMax] = useState(0);

  // Daily production entry state
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [prodQty, setProdQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");
  const [submittingProd, setSubmittingProd] = useState(false);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("order_items")
      .select("*, product:products(name, image_url, sku), order:orders(id, created_at, company:companies(business_name))")
      .in("department", ["Packing & Assembly", "Assembly", "Hampers", "Gifts"])
      .in("production_status", ["pending", "in_progress", "partial_ready"])
      .order("production_status", { ascending: true });
    setTasks((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase.from("products").select("id, name, image_url, sku").eq("is_active", true).order("name").limit(200);
      setProducts((data as ProductOption[]) || []);
    };
    loadProducts();
  }, []);

  const updateStatus = async (taskId: string, newStatus: string) => {
    setActing(taskId);
    const updateData: any = { production_status: newStatus };
    if (newStatus === "completed") {
      const task = tasks.find(t => t.id === taskId);
      updateData.actual_packed_qty = task?.quantity || 0;
    }
    await supabase.from("order_items").update(updateData).eq("id", taskId);
    toast.success(`Task → ${newStatus.replace("_", " ").toUpperCase()}`);
    fetchTasks();
    setActing(null);
  };

  const openKeypad = (task: AssemblyTask) => {
    setKeypadTaskId(task.id);
    setKeypadMax(task.quantity);
    setKeypadValue("");
    setKeypadOpen(true);
  };

  const submitPartialQty = async () => {
    if (!keypadTaskId) return;
    const qty = parseInt(keypadValue);
    if (isNaN(qty) || qty <= 0 || qty > keypadMax) {
      toast.error(`Enter a valid quantity (1-${keypadMax})`);
      return;
    }
    setActing(keypadTaskId);
    await supabase.from("order_items").update({
      production_status: "partial_ready",
      actual_packed_qty: qty,
    }).eq("id", keypadTaskId);
    toast.success(`Partial Ready: ${qty}/${keypadMax} units`);
    setKeypadOpen(false);
    fetchTasks();
    setActing(null);
  };

  const handleKeypadPress = (digit: string) => {
    if (digit === "DEL") {
      setKeypadValue(v => v.slice(0, -1));
    } else if (digit === "CLR") {
      setKeypadValue("");
    } else {
      setKeypadValue(v => v + digit);
    }
  };

  const sendMaterialRequest = async (task: AssemblyTask) => {
    setActing(task.id);
    await supabase.from("audit_logs").insert({
      action_type: "MATERIAL_REQUEST",
      module_name: "Assembly",
      entity_name: "order_items",
      entity_id: task.id,
      actor_id: user?.id || null,
      new_value: { product: task.product?.name, qty: task.quantity, order_id: task.order_id },
      risk_level: "high",
    });
    toast.success("🚨 Material Request sent to RGS/3PGS");
    setActing(null);
  };

  const submitDailyProduction = async () => {
    if (!selectedProductId || !prodQty) {
      toast.error("Select a product and enter quantity");
      return;
    }
    setSubmittingProd(true);
    await supabase.from("daily_production_logs").insert({
      product_id: selectedProductId,
      produced_qty: parseInt(prodQty) || 0,
      wastage_qty: parseInt(wastageQty) || 0,
      department: "Packing & Assembly",
      logged_by: user?.id || null,
    });
    toast.success("✅ Production logged to RGS Stock");
    setSelectedProductId(null);
    setProdQty("");
    setWastageQty("");
    setSubmittingProd(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Assembly Handheld</h1>
        <Badge variant="outline" className="text-xs">{tasks.length} Active Tasks</Badge>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="tasks" className="flex-1">Task Cards</TabsTrigger>
          <TabsTrigger value="production" className="flex-1">Daily Production</TabsTrigger>
        </TabsList>

        {/* === TAB 1: TASK CARDS === */}
        <TabsContent value="tasks">
          {tasks.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No assembly tasks pending.</CardContent></Card>
          )}

          <div className="grid gap-3">
            {tasks.map(task => (
              <Card key={task.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: task.production_status === "pending" ? "hsl(var(--chart-4))" : task.production_status === "in_progress" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))" }}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {task.product?.image_url ? (
                        <img src={task.product.image_url} alt={task.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{task.product?.name || "Unknown Product"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">SKU: {task.product?.sku || "N/A"} · SO#{task.order_id?.slice(0, 8).toUpperCase()}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-bold text-foreground">Qty: {task.quantity}</span>
                        <span className="text-[10px] text-muted-foreground">Ready: {task.actual_packed_qty ?? 0}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${statusColor[task.production_status || "pending"]}`}>
                          {(task.production_status || "pending").replace("_", " ")}
                        </Badge>
                        <StagnancyBadge createdAt={task.order?.created_at || null} />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    {task.production_status === "pending" && (
                      <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "in_progress")} disabled={acting === task.id}>
                        <Play size={14} className="mr-1" /> Start Work
                      </Button>
                    )}
                    {task.production_status === "in_progress" && (
                      <>
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openKeypad(task)} disabled={acting === task.id}>
                          <Hash size={14} className="mr-1" /> Partial Ready
                        </Button>
                        <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "completed")} disabled={acting === task.id}>
                          <CheckCircle2 size={14} className="mr-1" /> Full Ready
                        </Button>
                      </>
                    )}
                    {task.production_status === "partial_ready" && (
                      <Button size="sm" className="flex-1 text-xs" onClick={() => updateStatus(task.id, "completed")} disabled={acting === task.id}>
                        <CheckCircle2 size={14} className="mr-1" /> Full Ready
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => sendMaterialRequest(task)} disabled={acting === task.id}>
                      <Send size={14} className="mr-1" /> Request Material
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === TAB 2: DAILY PRODUCTION ENTRY === */}
        <TabsContent value="production">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Camera size={20} /> Daily Production Entry</h2>
              <p className="text-xs text-muted-foreground">Select product, enter produced qty, and submit to RGS stock.</p>

              {/* Photo-grid product selector */}
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`rounded-lg border-2 p-1 transition-all ${selectedProductId === p.id ? "border-primary bg-primary/10" : "border-muted bg-background hover:border-primary/40"}`}
                  >
                    <div className="w-full aspect-square rounded bg-muted flex items-center justify-center overflow-hidden">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package size={20} className="text-muted-foreground" />}
                    </div>
                    <p className="text-[10px] text-foreground truncate mt-1 font-medium">{p.name}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Produced Qty</label>
                  <Input type="number" value={prodQty} onChange={e => setProdQty(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Wastage Qty</label>
                  <Input type="number" value={wastageQty} onChange={e => setWastageQty(e.target.value)} placeholder="0" />
                </div>
              </div>

              <Button className="w-full" onClick={submitDailyProduction} disabled={submittingProd || !selectedProductId}>
                <Upload size={16} className="mr-2" /> Submit to Stock
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === NUMERIC KEYPAD MODAL === */}
      {keypadOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setKeypadOpen(false)}>
          <div className="bg-background rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1">Enter Partial Qty</h3>
            <p className="text-xs text-muted-foreground mb-4">Max: {keypadMax} units</p>

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