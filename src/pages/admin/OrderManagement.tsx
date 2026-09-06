import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScopedRealtimeSubscription } from "@/hooks/useScopedRealtimeSubscription";
import { ORDERS_ALL_CHANGES } from "@/lib/realtime";
import { Loader2, ChevronRight, Printer, Package, RefreshCw, Route } from "lucide-react";
import OrderTraceSheet from "@/components/admin/OrderTraceSheet";
import OrderLocatorPanel from "@/components/admin/OrderLocatorPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import StagnancyBadge from "@/components/StagnancyBadge";
import { shouldIgnoreOrderRegression } from "@/utils/orderStatus";
import { formatSalesOrderLabel } from "@/utils/orderSoLabel";
import { getPackedReadyBlockers, type PackedReadyBlocker } from "@/utils/packedReadyGate";
import {
  clearOrderForDispatch,
  confirmPrepaidOrderAwaitingAdvance,
  releaseOrderToInProduction,
  releaseOrderToPackedReady,
} from "@/lib/order-authority/orderAuthorityClient";
import { deriveFinanceReleaseState } from "@/utils/financeReleaseState";
import { FinanceReleaseChips } from "@/components/admin/FinanceReleaseChips";
import {
  governedOrderActionDisabledReason,
  GOVERNED_DIRECT_STATUSES,
  isGovernedOrderActionAvailable,
} from "@/utils/governedOrderActions";

const STATUS_FLOW = [
  { status: "submitted", label: "Order Placed", action: "Confirm Order", next: "confirmed", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { status: "confirmed", label: "Confirmed", action: "Send to Factory", next: "in_production", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { status: "manufacturing", label: "Manufacturing", action: "Mark Assembled", next: "assembled", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { status: "in_production", label: "Manufacturing", action: "Mark Assembled", next: "assembled", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { status: "assembled", label: "Assembled", action: "Send to Packing", next: "packing", color: "bg-violet-100 text-violet-800 border-violet-200" },
  { status: "packing", label: "Packing", action: "Mark Packed", next: "packed_ready", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { status: "packed_ready", label: "Packed Ready", action: "Request Payment", next: "awaiting_final_payment", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { status: "awaiting_final_payment", label: "Awaiting Payment", action: "Clear for Dispatch", next: "cleared_for_dispatch", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { status: "cleared_for_dispatch", label: "Cleared", action: "Governed Finalize", next: "dispatched", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { status: "dispatched", label: "Dispatched", action: "Confirm Delivery", next: "delivered", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { status: "delivered", label: "Delivered", action: null, next: null, color: "bg-green-100 text-green-800 border-green-200" },
  { status: "cancelled", label: "Cancelled", action: null, next: null, color: "bg-red-100 text-red-800 border-red-200" },
];

const getStatusInfo = (status: string) => STATUS_FLOW.find(s => s.status === status) || { label: status, action: null, next: null, color: "bg-muted text-muted-foreground border-border" };

/** Sidebar links slice STATUS_FLOW into two queues: shop-floor work vs pack / finance / dispatch handoff (same statuses as the linear flow, no new values). */
const PIPELINE_VIEW_PRODUCTION_STATUSES = new Set([
  "confirmed",
  "manufacturing",
  "in_production",
  "assembled",
]);

const PIPELINE_VIEW_PACKING_STATUSES = new Set([
  "packing",
  "packed_ready",
  "awaiting_final_payment",
  "cleared_for_dispatch",
  "dispatched",
]);

type PipelineView = "all" | "production" | "packing";

function parsePipelineViewParam(raw: string | null): PipelineView {
  if (raw === "production") return "production";
  if (raw === "packing") return "packing";
  return "all";
}

interface OrderRow {
  id: string;
  /** Persisted SO-YYYY-NNNNNN when present */
  order_number?: string | null;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  payment_status: string | null;
  advance_paid: number | null;
  advance_required: number | null;
  company_id: string | null;
  company: { business_name: string } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  product: { name: string } | null;
}

type PackingReqRow = {
  order_id: string;
  status: string | null;
  store_requisition_items?: { requested_qty: number; fulfilled_qty: number | null }[];
};

const OrderManagement = () => {
  const [searchParams] = useSearchParams();
  const pipelineView = parsePipelineViewParam(searchParams.get("view"));

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [traceOrderId, setTraceOrderId] = useState<string | null>(null);
  const [packingBlockersByOrder, setPackingBlockersByOrder] = useState<Record<string, PackedReadyBlocker[] | undefined>>({});

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, created_at, sales_order_value, payment_status, advance_paid, advance_required, company_id, company:companies(business_name)")
      .neq("status", "draft")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("OrderManagement fetch error:", error);
      toast.error("Failed to load orders");
    } else {
      setOrders((data as OrderRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useScopedRealtimeSubscription({
    domain: "orders",
    scope: { type: "global_staff" },
    changes: ORDERS_ALL_CHANGES,
    mode: "refetch",
    snapshot: fetchOrders,
    pollingFallbackMs: 30_000,
  });

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const packing = orders.filter((o) => o.status === "packing");
    if (packing.length === 0) {
      setPackingBlockersByOrder({});
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = packing.map((o) => o.id);
      const [itemsRes, reqsRes] = await Promise.all([
        supabase
          .from("order_items")
          .select("order_id, quantity, actual_packed_qty, production_status")
          .in("order_id", ids),
        supabase
          .from("store_requisitions")
          .select("order_id, status, store_requisition_items(requested_qty, fulfilled_qty)")
          .in("order_id", ids),
      ]);
      if (cancelled) return;
      const itemsByOrder = new Map<string, { quantity: number; actual_packed_qty: number | null; production_status: string | null }[]>();
      for (const row of (itemsRes.data as { order_id: string; quantity: number; actual_packed_qty: number | null; production_status: string | null }[]) || []) {
        if (!itemsByOrder.has(row.order_id)) itemsByOrder.set(row.order_id, []);
        itemsByOrder.get(row.order_id)!.push({
          quantity: row.quantity,
          actual_packed_qty: row.actual_packed_qty,
          production_status: row.production_status,
        });
      }
      const reqsByOrder = new Map<string, PackingReqRow[]>();
      for (const r of (reqsRes.data as PackingReqRow[]) || []) {
        if (!reqsByOrder.has(r.order_id)) reqsByOrder.set(r.order_id, []);
        reqsByOrder.get(r.order_id)!.push(r);
      }
      const next: Record<string, PackedReadyBlocker[]> = {};
      for (const o of packing) {
        next[o.id] = getPackedReadyBlockers({
          order: {
            status: o.status,
            payment_status: o.payment_status,
            advance_paid: o.advance_paid,
            advance_required: o.advance_required,
            sales_order_value: o.sales_order_value,
          },
          items: itemsByOrder.get(o.id) || [],
          requisitions: reqsByOrder.get(o.id) || [],
        });
      }
      setPackingBlockersByOrder(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [orders]);

  const displayOrders = useMemo(() => {
    if (pipelineView === "production") {
      return orders.filter((o) => PIPELINE_VIEW_PRODUCTION_STATUSES.has(o.status));
    }
    if (pipelineView === "packing") {
      return orders.filter((o) => PIPELINE_VIEW_PACKING_STATUSES.has(o.status));
    }
    return orders;
  }, [orders, pipelineView]);

  const handleAction = async (orderId: string, nextStatus: string) => {
    setActionLoading(orderId);
    const currentOrder = orders.find(o => o.id === orderId);
    if (nextStatus === "dispatched") {
      toast.error(
        "Mark Dispatched is disabled here. Use governed dispatch finalization after readiness, finance, and completion attestation.",
      );
      setActionLoading(null);
      return;
    }
    if (shouldIgnoreOrderRegression(currentOrder?.status, nextStatus)) {
      toast.error("Locked order status cannot move backward.");
      setActionLoading(null);
      return;
    }

    if (nextStatus === "cleared_for_dispatch") {
      try {
        await clearOrderForDispatch(orderId);
        toast.success(`Status updated to ${nextStatus.replace(/_/g, " ")}`);
        setActionLoading(null);
        fetchOrders();
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Dispatch clearance denied");
        setActionLoading(null);
        return;
      }
    }

    if (nextStatus === "packed_ready") {
      try {
        await releaseOrderToPackedReady(orderId);
        toast.success(`Status updated to ${nextStatus.replace(/_/g, " ")}`);
        setActionLoading(null);
        fetchOrders();
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Packed ready transition denied");
        setActionLoading(null);
        return;
      }
    }

    // ── CREDIT TIERING BRANCH ──
    // When confirming an order (submitted → confirmed), check the company's payment_terms.
    //   credit  → fast-track to in_production + send "Thank You" WhatsApp
    //   prepaid → keep at awaiting_advance and send manual UPI/bank instructions
    //             (Razorpay auto-link integration plugs in here later)
    let effectiveNext = nextStatus;
    let creditFastTracked = false;
    if (currentOrder?.status === "submitted" && nextStatus === "confirmed") {
      const { data: comp } = await supabase
        .from("companies")
        .select("id, business_name, phone, payment_terms")
        .eq("id", currentOrder.company_id || "")
        .maybeSingle();
      const terms = comp?.payment_terms || "prepaid";
      if (terms === "credit") {
        effectiveNext = "in_production";
        creditFastTracked = true;
      } else {
        effectiveNext = "awaiting_advance";
      }
    }

    if (creditFastTracked && effectiveNext === "in_production") {
      try {
        await releaseOrderToInProduction(orderId, "on_credit");
        if (currentOrder?.company_id) {
          const { data: comp } = await supabase
            .from("companies")
            .select("business_name, phone")
            .eq("id", currentOrder.company_id)
            .maybeSingle();
          const orderRef = formatSalesOrderLabel({
            id: orderId,
            order_number: currentOrder?.order_number,
          });
          const phone = (comp as { phone?: string } | null)?.phone;
          const businessName = (comp as { business_name?: string } | null)?.business_name || "Valued Customer";
          if (phone) {
            await supabase.functions.invoke("send-whatsapp", {
              body: {
                to: phone,
                message:
                  `Dear ${businessName},\n\n` +
                  `Thank you for your order ${orderRef}. As a valued credit-account partner, your order has been confirmed and moved directly into production.\n\n` +
                  `Track your 10-point artisan journey on the B2B portal.\n\n` +
                  `— Team Oasis Baklawa`,
                company_id: currentOrder.company_id,
                order_id: orderId,
              },
            }).catch(() => {});
          }
        }
        toast.success("Credit customer fast-tracked to production");
        setActionLoading(null);
        fetchOrders();
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Production release denied");
        setActionLoading(null);
        return;
      }
    }

    const governedStatus = GOVERNED_DIRECT_STATUSES;
    if (!governedStatus.has(effectiveNext)) {
      toast.error(
        `Transition to ${effectiveNext.replace(/_/g, " ")} is not available via direct status update — use the governed finance/operations workflow.`,
      );
      setActionLoading(null);
      return;
    }

    if (effectiveNext === "awaiting_advance" && currentOrder?.status === "submitted") {
      try {
        await confirmPrepaidOrderAwaitingAdvance(orderId);
        if (currentOrder.company_id) {
          const { data: comp } = await supabase
            .from("companies")
            .select("business_name, phone")
            .eq("id", currentOrder.company_id)
            .maybeSingle();
          const orderRef = formatSalesOrderLabel({
            id: orderId,
            order_number: currentOrder?.order_number,
          });
          const phone = (comp as { phone?: string } | null)?.phone;
          const businessName = (comp as { business_name?: string } | null)?.business_name || "Valued Customer";
          if (phone) {
            await supabase.functions.invoke("send-whatsapp", {
              body: {
                to: phone,
                message:
                  `Dear ${businessName},\n\n` +
                  `Your order ${orderRef} has been confirmed and is awaiting advance payment.\n\n` +
                  `Please remit the advance via UPI / NEFT / RTGS to the bank details shared by your Sales Executive, or reply to this message for assistance.\n\n` +
                  `Once payment is verified, your order will move into production.\n\n` +
                  `— Team Oasis Baklawa`,
                company_id: currentOrder.company_id,
                order_id: orderId,
              },
            }).catch(() => {});
          }
        }
        toast.success("Order confirmed — awaiting advance payment");
        setActionLoading(null);
        fetchOrders();
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Order confirmation denied");
        setActionLoading(null);
        return;
      }
    }

    if (effectiveNext === "in_production") {
      try {
        await releaseOrderToInProduction(orderId, currentOrder?.payment_status);
        toast.success(`Status updated to ${effectiveNext.replace(/_/g, " ")}`);
        setActionLoading(null);
        fetchOrders();
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Production release denied");
        setActionLoading(null);
        return;
      }
    }

    toast.error("Unsupported status transition on this screen.");
    setActionLoading(null);
  };

  const openPickingList = async (orderId: string) => {
    setSelectedOrder(orderId);
    setItemsLoading(true);
    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, pack_size, product:products(name)")
      .eq("order_id", orderId);
    setOrderItems((data as OrderItem[]) ?? []);
    setItemsLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Order Management</h1>
          <p className="text-sm text-muted-foreground">
            {displayOrders.length} orders
            {pipelineView === "production" ? " · Production" : pipelineView === "packing" ? " · Packing & Dispatch" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-2">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <OrderLocatorPanel onOpenTrace={(id) => setTraceOrderId(id)} />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[220px]">Finance release</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Packed ready gate</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Action</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No orders found</td></tr>
            )}
            {orders.length > 0 && displayOrders.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No orders in this view</td></tr>
            )}
            {displayOrders.map((order) => {
              const info = getStatusInfo(order.status);
              const companyName = order.company?.business_name ?? "—";
              const packingGate = packingBlockersByOrder[order.id];
              const packingGateBlocked =
                order.status === "packing" &&
                (packingGate === undefined || packingGate.length > 0);
              const actionUnavailable = info.next ? !isGovernedOrderActionAvailable(order.status, info.next) : false;
              const actionDisabledReason = info.next
                ? governedOrderActionDisabledReason(order.status, info.next)
                : "";
              return (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    <div className="flex items-center gap-2">
                      <StagnancyBadge createdAt={order.created_at} />
                      {formatSalesOrderLabel(order)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{companyName}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${info.color}`}>
                      {info.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left align-top">
                    <FinanceReleaseChips
                      variant="compact"
                      className="max-w-md"
                      state={deriveFinanceReleaseState({
                        status: order.status,
                        payment_status: order.payment_status,
                        advance_paid: order.advance_paid,
                        advance_required: order.advance_required,
                        sales_order_value: order.sales_order_value,
                      })}
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {order.status !== "packing" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : packingGate === undefined ? (
                      <Loader2 size={12} className="inline animate-spin text-muted-foreground" />
                    ) : packingGate.length === 0 ? (
                      <span className="font-medium text-emerald-600" title="Eligible for packed_ready">
                        Eligible
                      </span>
                    ) : (
                      <span
                        className="font-medium text-destructive cursor-help"
                        title={packingGate.map((b) => b.message).join("\n")}
                      >
                        Blocked ({packingGate.length})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {info.action && info.next ? (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={
                          actionLoading === order.id
                          || packingGateBlocked
                          || actionUnavailable
                        }
                        title={actionUnavailable ? actionDisabledReason : undefined}
                        onClick={(e) => { e.stopPropagation(); handleAction(order.id, info.next!); }}
                        className="text-xs gap-1"
                      >
                        {actionLoading === order.id ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                        {info.action}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openPickingList(order.id)} className="gap-1 text-xs">
                        <Package size={12} /> View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setTraceOrderId(order.id)} className="gap-1 text-xs">
                        <Route size={12} /> Trace
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Picking List Sidebar */}
      <Sheet open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package size={18} /> Picking List
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {selectedOrder && (
              <p className="mb-3 font-mono text-xs text-muted-foreground">
                Order:{" "}
                <span className="font-medium text-foreground">
                  {formatSalesOrderLabel(orders.find((o) => o.id === selectedOrder) ?? { id: selectedOrder })}
                </span>
              </p>
            )}
            {itemsLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : orderItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No items found for this order.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Qty</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Pack</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-foreground">{item.product?.name ?? "—"}</td>
                      <td className="py-2 text-right font-mono text-foreground">{item.quantity}</td>
                      <td className="py-2 text-right text-muted-foreground">{item.pack_size ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Button
              variant="outline"
              className="w-full mt-4 gap-2"
              disabled
              title="Packing Slip printing is not enabled yet"
            >
              <Printer size={14} /> Print unavailable — Packing Slip
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <OrderTraceSheet
        orderId={traceOrderId}
        open={!!traceOrderId}
        onOpenChange={(o) => {
          if (!o) setTraceOrderId(null);
        }}
      />
    </div>
  );
};

export default OrderManagement;
