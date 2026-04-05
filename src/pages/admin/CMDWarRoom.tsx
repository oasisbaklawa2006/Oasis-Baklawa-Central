import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, AlertTriangle, Eye, EyeOff } from "lucide-react";
import StagnancyBadge from "@/components/StagnancyBadge";

const STEPS = [
  { key: "draft", label: "Cart / Draft", statuses: ["draft", "cart"] },
  { key: "finance", label: "Finance Approval", statuses: ["submitted", "confirmed"] },
  { key: "production", label: "Production / FGS", statuses: ["manufacturing"] },
  { key: "assembly", label: "Assembly", statuses: ["assembly"] },
  { key: "packing", label: "Packing", statuses: ["packing", "packed_ready"] },
  { key: "billing", label: "Billing / E-Way", statuses: ["invoice_generated", "awaiting_payment", "payment_cleared"] },
  { key: "security", label: "Security Exit", statuses: ["dispatched", "in_transit"] },
  { key: "support", label: "10-Day Support", statuses: ["delivered"] },
];

function getActiveStep(status: string) {
  const s = (status || "").toLowerCase().replace(/[\s-]/g, "_");
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].statuses.includes(s)) return i;
  }
  return 0;
}

interface Order {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  dispatch_urgency: string | null;
  company_id: string | null;
  company_name?: string;
  has_complaint?: boolean;
}

const CMDWarRoom = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, dispatch_urgency, company_id")
      .not("status", "in", '("closed","cancelled")')
      .order("created_at", { ascending: false })
      .limit(200);

    if (!data) return;

    // Fetch company names for CMD view
    const companyIds = [...new Set(data.map((o) => o.company_id).filter(Boolean))] as string[];
    let companyMap: Record<string, string> = {};
    if (companyIds.length) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, business_name")
        .in("id", companyIds);
      companies?.forEach((c) => { companyMap[c.id] = c.business_name; });
    }

    // Check for complaints (support_tickets on these orders)
    const orderIds = data.map((o) => o.id);
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("order_id")
      .in("order_id", orderIds);
    const complainedOrders = new Set(tickets?.map((t) => t.order_id) ?? []);

    setOrders(
      data.map((o) => ({
        ...o,
        company_name: o.company_id ? companyMap[o.company_id] ?? "Unknown" : "Unknown",
        has_complaint: complainedOrders.has(o.id),
      }))
    );
  };

  useEffect(() => {
    fetchOrders();
    const ch = supabase.channel("war-room-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      // Complaints first
      if (a.has_complaint && !b.has_complaint) return -1;
      if (!a.has_complaint && b.has_complaint) return 1;
      // Then panic
      if (a.dispatch_urgency === "panic" && b.dispatch_urgency !== "panic") return -1;
      if (a.dispatch_urgency !== "panic" && b.dispatch_urgency === "panic") return 1;
      return 0;
    });
  }, [orders]);

  const visibleOrders = sortedOrders.filter((o) => showHidden || !hidden.has(o.id));

  const toggleHide = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 space-y-4 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          ⚔️ CMD War Room — Live Order Battlefield
        </h1>
        <button
          onClick={() => setShowHidden(!showHidden)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border"
        >
          {showHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          {showHidden ? "Hide Minimized" : `Show Minimized (${hidden.size})`}
        </button>
      </div>

      {visibleOrders.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">No active orders in the pipeline.</p>
      )}

      <div className="space-y-3">
        {visibleOrders.map((order) => {
          const activeStep = getActiveStep(order.status);
          const isPanic = order.dispatch_urgency === "panic";
          const isComplaint = order.has_complaint;
          const isMinimized = hidden.has(order.id);

          return (
            <div
              key={order.id}
              className={`rounded-xl border p-4 transition-all
                ${isComplaint ? "bg-red-500/5 border-red-500/40" : isPanic ? "border-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.25)]" : "bg-card border-border"}
                ${isPanic ? "animate-pulse" : ""}
              `}
              style={isPanic ? { animationDuration: "2s" } : undefined}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <StagnancyBadge createdAt={order.created_at} />
                  <div>
                    <span className="text-sm font-bold text-foreground">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {order.company_name}
                    </span>
                  </div>
                  {isPanic && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> PANIC
                    </span>
                  )}
                  {isComplaint && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                      🚨 COMPLAINT RAISED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                  </span>
                  <button
                    onClick={() => toggleHide(order.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={isMinimized ? "Restore" : "Minimize"}
                  >
                    {isMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
              </div>

              {/* Lifecycle Steps */}
              {!isMinimized && (
                <div className="flex items-center gap-0 overflow-x-auto pb-1">
                  {STEPS.map((step, i) => {
                    const isActive = i === activeStep;
                    const isCompleted = i < activeStep;
                    return (
                      <div key={step.key} className="flex items-center">
                        <div
                          className={`flex flex-col items-center min-w-[90px] px-2 py-2 rounded-lg text-center transition-all
                            ${isActive ? "bg-primary/10 ring-1 ring-primary/30" : isCompleted ? "opacity-60" : "opacity-30"}
                          `}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1
                              ${isActive ? "bg-primary text-primary-foreground" : isCompleted ? "bg-muted-foreground/40 text-background" : "bg-muted text-muted-foreground"}
                            `}
                          >
                            {isCompleted ? "✓" : i + 1}
                          </div>
                          <span className={`text-[10px] font-medium leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                            {step.label}
                          </span>
                          {isActive && (
                            <span className="mt-1 text-[9px] font-semibold text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                              CURRENT
                            </span>
                          )}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`w-4 h-[2px] ${i < activeStep ? "bg-muted-foreground/40" : "bg-border"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CMDWarRoom;
