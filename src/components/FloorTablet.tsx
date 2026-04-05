import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Play, CheckCircle2, Clock, AlertTriangle, Monitor, Hash, Send, Upload, Camera, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import StagnancyBadge from "@/components/StagnancyBadge";

interface FloorTask {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  notes: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
  order?: { id: string; created_at: string | null } | null;
}

interface ProductOption {
  id: string;
  name: string;
  image_url: string | null;
  sku: string | null;
}

interface FloorTabletProps {
  department: string;
  departmentFilter: string[];
  title: string;
}

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-700 border-amber-400/40",
  in_progress: "bg-blue-500/20 text-blue-700 border-blue-400/40",
  partial_ready: "bg-purple-500/20 text-purple-700 border-purple-400/40",
  completed: "bg-emerald-500/20 text-emerald-700 border-emerald-400/40",
};

export default function FloorTablet({ department, departmentFilter, title }: FloorTabletProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<FloorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [mode, setMode] = useState<"dashboard" | "detail" | "production" | "tv">("dashboard");
  const [selectedTask, setSelectedTask] = useState<FloorTask | null>(null);

  // Numeric keypad
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadValue, setKeypadValue] = useState("");
  const [keypadMax, setKeypadMax] = useState(0);
  const [keypadTaskId, setKeypadTaskId] = useState<string | null>(null);

  // Daily production
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [prodQty, setProdQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");
  const [submittingProd, setSubmittingProd] = useState(false);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, department, notes, product:products(name, image_url, sku), order:orders(id, created_at)")
      .in("department", departmentFilter)
      .in("production_status", ["pending", "in_progress", "partial_ready", "completed"])
      .order("production_status", { ascending: true });
    setTasks((data as any[]) || []);
    setLoading(false);
  }, [departmentFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Load products for daily production entry
  useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, image_url, sku")
        .eq("is_active", true)
        .order("name")
        .limit(100);
      setProducts((data as ProductOption[]) || []);
    };
    loadProducts();
  }, []);

  // Auto-refresh for TV mode
  useEffect(() => {
    if (mode !== "tv") return;
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [mode, fetchTasks]);

  const updateStatus = async (taskId: string, newStatus: string, partialQty?: number) => {
    setActing(taskId);
    const updateData: any = { production_status: newStatus };
    if (newStatus === "completed") {
      const task = tasks.find(t => t.id === taskId);
      updateData.actual_packed_qty = task?.quantity || 0;
    } else if (newStatus === "partial_ready" && partialQty !== undefined) {
      updateData.actual_packed_qty = partialQty;
    }
    await supabase.from("order_items").update(updateData).eq("id", taskId);
    toast.success(`Task → ${newStatus.replace("_", " ").toUpperCase()}`);
    fetchTasks();
    setActing(null);
    if (mode === "detail") setMode("dashboard");
  };

  const openKeypad = (task: FloorTask) => {
    setKeypadTaskId(task.id);
    setKeypadMax(task.quantity);
    setKeypadValue(String(task.actual_packed_qty || ""));
    setKeypadOpen(true);
  };

  const handleKeypadPress = (digit: string) => {
    if (digit === "DEL") setKeypadValue(v => v.slice(0, -1));
    else if (digit === "CLR") setKeypadValue("");
    else setKeypadValue(v => v + digit);
  };

  const submitPartialQty = async () => {
    if (!keypadTaskId) return;
    const qty = parseInt(keypadValue);
    if (isNaN(qty) || qty <= 0 || qty > keypadMax) {
      toast.error(`Enter 1-${keypadMax}`);
      return;
    }
    setKeypadOpen(false);
    await updateStatus(keypadTaskId, "partial_ready", qty);
  };

  const sendMaterialRequest = async (task: FloorTask) => {
    setActing(task.id);
    await supabase.from("audit_logs").insert({
      action_type: "MATERIAL_REQUEST",
      module_name: department,
      entity_name: "order_items",
      entity_id: task.id,
      actor_id: user?.id || null,
      new_value: { product: task.product?.name, qty: task.quantity, order_id: task.order_id },
      risk_level: "high",
    });
    toast.success("🚨 Material Request sent to RGS");
    setActing(null);
  };

  const submitDailyProduction = async () => {
    if (!selectedProductId || !prodQty) { toast.error("Select product & enter qty"); return; }
    setSubmittingProd(true);
    await supabase.from("daily_production_logs").insert({
      product_id: selectedProductId,
      produced_qty: parseInt(prodQty) || 0,
      wastage_qty: parseInt(wastageQty) || 0,
      department,
      logged_by: user?.id || null,
    });
    toast.success("✅ Production logged");
    setSelectedProductId(null);
    setProdQty("");
    setWastageQty("");
    setSubmittingProd(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={28} /></div>;

  const pending = tasks.filter(t => t.production_status === "pending");
  const inProcess = tasks.filter(t => t.production_status === "in_progress" || t.production_status === "partial_ready");
  const ready = tasks.filter(t => t.production_status === "completed");
  const active = tasks.filter(t => t.production_status !== "completed");

  const now = new Date();
  const panicTasks = active.filter(t => {
    if (!t.order?.created_at) return false;
    const age = (now.getTime() - new Date(t.order.created_at).getTime()) / 3600000;
    return age > 4;
  });

  // === TV MODE ===
  if (mode === "tv") {
    return (
      <div className="space-y-4 min-h-screen">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{title} — TV View</h1>
          <Button size="sm" variant="outline" onClick={() => setMode("dashboard")}>
            <Package size={14} className="mr-1" /> Handheld
          </Button>
        </div>

        {panicTasks.length > 0 && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 animate-pulse">
            <h2 className="text-xl font-bold text-destructive flex items-center gap-2">
              <AlertTriangle size={24} /> 🚨 PANIC — {panicTasks.length} Stagnant (&gt;4h)
            </h2>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {panicTasks.map(t => (
                <div key={t.id} className="bg-destructive/20 rounded-lg p-3">
                  <p className="text-lg font-bold text-destructive">{t.product?.name?.slice(0, 25)}</p>
                  <p className="text-sm font-mono text-destructive/80">SO#{t.order_id?.slice(0, 8).toUpperCase()} · Qty: {t.quantity}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "⏳ PENDING", items: pending, color: "amber", icon: <Clock size={20} className="text-amber-500" /> },
            { label: "🔧 IN PROCESS", items: inProcess, color: "blue", icon: <Play size={20} className="text-blue-500" /> },
            { label: "✅ READY", items: ready, color: "emerald", icon: <CheckCircle2 size={20} className="text-emerald-500" /> },
          ].map(col => (
            <div key={col.label}>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                {col.icon} {col.label} ({col.items.length})
              </h2>
              <div className="space-y-2">
                {col.items.map(t => {
                  const progressPct = t.quantity > 0 ? Math.round(((t.actual_packed_qty || 0) / t.quantity) * 100) : 0;
                  return (
                    <Card key={t.id} className={`border-l-4 border-l-${col.color}-500 ${col.label.includes("READY") ? "animate-pulse" : ""}`}>
                      <CardContent className="p-3">
                        <p className="text-lg font-bold text-foreground">{t.product?.name?.slice(0, 30)}</p>
                        <p className="text-sm font-mono text-muted-foreground">SKU: {t.product?.sku || "N/A"} · Qty: {t.actual_packed_qty ?? 0}/{t.quantity}</p>
                        <Progress value={progressPct} className="h-2 mt-2" />
                        <StagnancyBadge createdAt={t.order?.created_at || null} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === SCREEN 2: TASK DETAIL ===
  if (mode === "detail" && selectedTask) {
    const progressPct = selectedTask.quantity > 0 ? Math.round(((selectedTask.actual_packed_qty || 0) / selectedTask.quantity) * 100) : 0;
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setMode("dashboard"); setSelectedTask(null); }} className="text-xs">
          ← Back to Dashboard
        </Button>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {selectedTask.product?.image_url ? (
                  <img src={selectedTask.product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package size={32} className="text-muted-foreground" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{selectedTask.product?.name}</h2>
                <p className="text-sm text-muted-foreground font-mono">SKU: {selectedTask.product?.sku || "N/A"}</p>
                <p className="text-sm text-muted-foreground">SO#{selectedTask.order_id?.slice(0, 8).toUpperCase()}</p>
                <div className="flex gap-2 mt-2">
                  <Badge className={`text-xs border ${statusColor[selectedTask.production_status || "pending"]}`}>
                    {(selectedTask.production_status || "pending").replace("_", " ")}
                  </Badge>
                  <StagnancyBadge createdAt={selectedTask.order?.created_at || null} />
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{selectedTask.actual_packed_qty || 0}/{selectedTask.quantity} ({progressPct}%)</span>
              </div>
              <Progress value={progressPct} className="h-3" />
            </div>

            {selectedTask.notes && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground"><FileText size={12} className="inline mr-1" />Notes: {selectedTask.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {selectedTask.production_status === "pending" && (
                <Button className="col-span-2" onClick={() => updateStatus(selectedTask.id, "in_progress")} disabled={acting === selectedTask.id}>
                  <Play size={16} className="mr-2" /> Start Work
                </Button>
              )}
              {(selectedTask.production_status === "in_progress" || selectedTask.production_status === "partial_ready") && (
                <>
                  <Button variant="outline" onClick={() => openKeypad(selectedTask)} disabled={acting === selectedTask.id}>
                    <Hash size={16} className="mr-2" /> Partial Ready
                  </Button>
                  <Button onClick={() => updateStatus(selectedTask.id, "completed")} disabled={acting === selectedTask.id}>
                    <CheckCircle2 size={16} className="mr-2" /> Full Ready
                  </Button>
                </>
              )}
            </div>

            <Button variant="destructive" className="w-full" onClick={() => sendMaterialRequest(selectedTask)} disabled={acting === selectedTask.id}>
              <Send size={16} className="mr-2" /> Request Material from RGS
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === SCREEN 1: DASHBOARD (Handheld) + SCREEN 3: DAILY PRODUCTION ===
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <div className="flex gap-2">
          <Badge variant="outline">{active.length} Active</Badge>
          <Button size="sm" variant="outline" onClick={() => setMode("tv")}>
            <Monitor size={14} className="mr-1" /> TV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="tasks" className="flex-1">📋 Tasks</TabsTrigger>
          <TabsTrigger value="production" className="flex-1">📊 Daily Production</TabsTrigger>
        </TabsList>

        {/* Screen 1: Task Dashboard */}
        <TabsContent value="tasks">
          {active.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks for {department}.</CardContent></Card>
          )}

          {/* Panic section */}
          {panicTasks.length > 0 && (
            <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 mb-3 animate-pulse">
              <p className="text-sm font-bold text-destructive">🚨 {panicTasks.length} tasks stagnant &gt;4h</p>
            </div>
          )}

          <div className="grid gap-3">
            {active.map(task => {
              const progressPct = task.quantity > 0 ? Math.round(((task.actual_packed_qty || 0) / task.quantity) * 100) : 0;
              return (
                <Card key={task.id} className="overflow-hidden border-l-4 cursor-pointer active:scale-[0.99] transition-transform"
                  style={{ borderLeftColor: task.production_status === "pending" ? "hsl(var(--chart-4))" : "hsl(var(--chart-1))" }}
                  onClick={() => { setSelectedTask(task); setMode("detail"); }}>
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
                        <p className="font-semibold text-sm text-foreground truncate">{task.product?.name || "Unknown"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">SKU: {task.product?.sku || "N/A"} · SO#{task.order_id?.slice(0, 8).toUpperCase()}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-bold text-foreground">Qty: {task.actual_packed_qty ?? 0}/{task.quantity}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 border ${statusColor[task.production_status || "pending"]}`}>
                            {(task.production_status || "pending").replace("_", " ")}
                          </Badge>
                          <StagnancyBadge createdAt={task.order?.created_at || null} />
                        </div>
                        <Progress value={progressPct} className="h-1.5 mt-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Screen 3: Daily Production Entry */}
        <TabsContent value="production">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Camera size={20} /> Daily Production Entry</h2>
              <p className="text-xs text-muted-foreground">Log manufactured qty for {department}.</p>

              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {products.map(p => (
                  <button key={p.id} onClick={() => setSelectedProductId(p.id)}
                    className={`rounded-lg border-2 p-1 transition-all ${selectedProductId === p.id ? "border-primary bg-primary/10" : "border-muted bg-background hover:border-primary/40"}`}>
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
