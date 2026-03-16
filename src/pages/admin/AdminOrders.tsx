import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Loader2, Package } from "lucide-react";

const STATUSES = ["awaiting_advance", "in_production", "assembly", "packing"] as const;
type OrderStatus = typeof STATUSES[number];

const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_advance: "Awaiting Advance",
  in_production: "In Production",
  assembly: "Assembly",
  packing: "Packing",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  awaiting_advance: "#f59e0b",
  in_production: "#3b82f6",
  assembly: "#8b5cf6",
  packing: "#10b981",
};

interface OrderCard {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  company?: { business_name: string } | null;
  order_items?: { quantity: number; carton_type: string | null }[];
}

const AdminOrders = () => {
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, company:companies(business_name), order_items(quantity, carton_type)")
      .in("status", [...STATUSES]);

    setOrders((data as unknown as OrderCard[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const nextStatus = (current: string): string | null => {
    const idx = STATUSES.indexOf(current as OrderStatus);
    if (idx < 0 || idx >= STATUSES.length - 1) return null;
    return STATUSES[idx + 1];
  };

  const handleAdvance = async (order: OrderCard) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setUpdating(order.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);

    if (error) toast.error("Failed to update status");
    else {
      toast.success(`Moved to ${STATUS_LABELS[next as OrderStatus]}`);
      fetchOrders();
    }
    setUpdating(null);
  };

  const getTotalCartons = (items?: { quantity: number; carton_type: string | null }[]) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, it) => sum + it.quantity, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "#c6a769" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl" style={{ color: "#c6a769" }}>Order Queue</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {STATUSES.map((status) => {
          const statusOrders = orders.filter((o) => o.status === status);
          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                <h3 className="font-body font-semibold text-sm text-white">{STATUS_LABELS[status]}</h3>
                <span className="text-xs text-[#666] font-body">({statusOrders.length})</span>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {statusOrders.length === 0 && (
                  <p className="text-[#555] text-xs font-body px-3 py-6 text-center rounded-lg border border-dashed" style={{ borderColor: "#2a2a2a" }}>
                    No orders
                  </p>
                )}
                {statusOrders.map((order) => {
                  const next = nextStatus(order.status);
                  return (
                    <div
                      key={order.id}
                      className="rounded-xl p-4 space-y-3 border"
                      style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-body font-semibold text-white text-sm">
                            {order.company?.business_name ?? "Unknown"}
                          </p>
                          <p className="font-body text-[11px] text-[#666] mt-0.5">
                            {order.id.slice(0, 8)}…
                          </p>
                        </div>
                        <Package size={16} style={{ color: STATUS_COLORS[order.status as OrderStatus] }} />
                      </div>

                      <div className="flex justify-between text-xs font-body">
                        <span className="text-[#888]">Cartons</span>
                        <span className="text-white font-semibold">{getTotalCartons(order.order_items)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-body">
                        <span className="text-[#888]">Value</span>
                        <span className="text-white font-semibold">
                          ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                        </span>
                      </div>

                      {next && (
                        <button
                          onClick={() => handleAdvance(order)}
                          disabled={updating === order.id}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          style={{ backgroundColor: STATUS_COLORS[next as OrderStatus] + "20", color: STATUS_COLORS[next as OrderStatus] }}
                        >
                          {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                          Move to {STATUS_LABELS[next as OrderStatus]}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminOrders;
