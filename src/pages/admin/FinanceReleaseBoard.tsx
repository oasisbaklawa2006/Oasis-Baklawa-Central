import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/auth-routing";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Receipt, Hammer, Truck, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

/** Matches spec roles in DB form: finance_exec → FINANCE_EXEC, cmd → OWNER, director tier → FINANCE_HEAD. */
const FINANCE_BOARD_ROLES = new Set([
  "ADMIN",
  "SUPER_ADMIN",
  "FINANCE_EXEC",
  "FINANCE_HEAD",
  "OWNER",
]);

const READY_PAYMENT_STATUSES = ["verified_advance", "on_credit", "paid", "advance_paid"] as const;
const READY_TAB_ORDER_STATUSES = ["submitted", "approved"] as const;

function isReadyPaymentStatus(ps: string | null): boolean {
  return !!ps && (READY_PAYMENT_STATUSES as readonly string[]).includes(ps);
}

function isReadyTabOrderStatus(st: string): boolean {
  return (READY_TAB_ORDER_STATUSES as readonly string[]).includes(st);
}

interface BoardOrder {
  id: string;
  status: string;
  payment_status: string | null;
  sales_order_value: number | null;
  advance_required: number | null;
  advance_paid: number | null;
  created_at: string | null;
  payment_receipt_url: string | null;
  tracking_number: string | null;
  actual_despatch_date: string | null;
  company?: { business_name: string } | null;
}

interface ReviewLineProduct {
  name: string | null;
}

interface ReviewLineItem {
  id: string;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  product?: ReviewLineProduct | null;
}

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");

const isoNow = () => new Date().toISOString();

const FinanceReleaseBoard = () => {
  const { user, role } = useAuth();
  const normalizedRole = normalizeRole(role) ?? "";

  const [loading, setLoading] = useState(true);
  const [awaiting, setAwaiting] = useState<BoardOrder[]>([]);
  const [ready, setReady] = useState<BoardOrder[]>([]);
  const [inProduction, setInProduction] = useState<BoardOrder[]>([]);
  const [dispatchReady, setDispatchReady] = useState<BoardOrder[]>([]);
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, ReviewLineItem[]>>({});
  const [reviewOrder, setReviewOrder] = useState<BoardOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [latestUtrByOrderId, setLatestUtrByOrderId] = useState<Record<string, string>>({});

  const canAccess = FINANCE_BOARD_ROLES.has(normalizedRole);

  const loadBoard = useCallback(async () => {
    if (!canAccess || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const baseSelect =
      "id, status, payment_status, sales_order_value, advance_required, advance_paid, created_at, payment_receipt_url, tracking_number, actual_despatch_date, company:companies(business_name)";

    const [aq, rq, pq, dq] = await Promise.all([
      supabase
        .from("orders")
        .select(baseSelect)
        .neq("status", "draft")
        .or("payment_status.eq.awaiting_receipt,payment_status.eq.under_review")
        .order("created_at", { ascending: false }),

      supabase
        .from("orders")
        .select(baseSelect)
        .in(
          "payment_status",
          ["verified_advance", "on_credit", "paid", "advance_paid"] as unknown as readonly string[],
        )
        .in("status", ["submitted", "approved"] as readonly string[])
        .order("created_at", { ascending: false }),

      supabase
        .from("orders")
        .select(baseSelect)
        .eq("status", "in_production")
        .order("created_at", { ascending: false }),

      supabase
        .from("orders")
        .select(baseSelect)
        .in("status", ["dispatched", "partially_fulfilled"] as readonly string[])
        .order("created_at", { ascending: false }),
    ]);

    const logErr = (label: string, err: typeof aq.error) => {
      if (err) console.error(`[FinanceReleaseBoard] ${label}`, err);
    };

    logErr("awaiting", aq.error);
    logErr("ready", rq.error);
    logErr("in_production", pq.error);
    logErr("dispatch", dq.error);

    setAwaiting((aq.data as BoardOrder[]) ?? []);
    setReady((rq.data as BoardOrder[]) ?? []);
    const prodRows = (pq.data as BoardOrder[]) ?? [];
    setInProduction(prodRows);
    setDispatchReady((dq.data as BoardOrder[]) ?? []);

    if (prodRows.length > 0) {
      const ids = prodRows.map((o) => o.id);
      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select(
          "id, order_id, quantity, actual_packed_qty, production_status, product:products(name)",
        )
        .in("order_id", ids);

      if (itemsErr) console.error("[FinanceReleaseBoard] order_items", itemsErr);
      const map: Record<string, ReviewLineItem[]> = {};
      (items ?? []).forEach((row: Record<string, unknown>) => {
        const oid = row.order_id as string;
        const line: ReviewLineItem = {
          id: row.id as string,
          quantity: Number(row.quantity),
          actual_packed_qty: row.actual_packed_qty as number | null,
          production_status: row.production_status as string | null,
          product: row.product as ReviewLineProduct | null,
        };
        if (!map[oid]) map[oid] = [];
        map[oid].push(line);
      });
      setItemsByOrderId(map);
    } else setItemsByOrderId({});

    setLoading(false);
  }, [canAccess, user]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const fetchLatestUtr = async (orderId: string) => {
    const { data, error } = await supabase
      .from("order_payments")
      .select("reference_no, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error && data?.[0]) {
      const ref = (data[0] as { reference_no: string | null }).reference_no;
      setLatestUtrByOrderId((prev) => ({ ...prev, [orderId]: ref?.trim() || "—" }));
    } else {
      setLatestUtrByOrderId((prev) => ({ ...prev, [orderId]: "—" }));
    }
  };

  useEffect(() => {
    if (reviewOrder) void fetchLatestUtr(reviewOrder.id);
    else setRejectReason("");
  }, [reviewOrder]);

  const runVerifyAction = async (kind: "verify" | "credit") => {
    if (!reviewOrder || !user) return;
    setActingId(reviewOrder.id);
    try {
      const patch =
        kind === "verify"
          ? {
              payment_status: "verified_advance",
              finance_verified_by: user.id,
              finance_verified_at: isoNow(),
            }
          : {
              payment_status: "on_credit",
              finance_verified_by: user.id,
              finance_verified_at: isoNow(),
            };
      const { error } = await supabase.from("orders").update(patch).eq("id", reviewOrder.id);
      if (error) throw error;
      toast.success(kind === "verify" ? "Payment verified." : "Credit approved.");
      setReviewOrder(null);
      await loadBoard();
    } catch (e) {
      console.error("[FinanceReleaseBoard]", e);
      toast.error("Could not update order.");
    } finally {
      setActingId(null);
    }
  };

  const runReject = async () => {
    if (!reviewOrder || !user) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      toast.error("Rejection requires a reason.");
      return;
    }
    setActingId(reviewOrder.id);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "awaiting_receipt",
        })
        .eq("id", reviewOrder.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action_type: "finance_board_reject",
        module_name: "finance_release_board",
        entity_name: "orders",
        entity_id: reviewOrder.id,
        actor_id: user.id,
        reason: trimmed,
      });

      toast.success("Buyer asked to update payment receipt.");
      setReviewOrder(null);
      await loadBoard();
    } catch (e) {
      console.error("[FinanceReleaseBoard]", e);
      toast.error("Could not reject.");
    } finally {
      setActingId(null);
    }
  };

  const pushToFloor = async (order: BoardOrder) => {
    if (!isReadyPaymentStatus(order.payment_status)) return;
    if (!isReadyTabOrderStatus(order.status)) return;
    setActingId(order.id);
    try {
      const { error } = await supabase.from("orders").update({ status: "in_production" }).eq("id", order.id);
      if (error) throw error;
      toast.success("Released to factory floor.");
      await loadBoard();
    } catch (e) {
      console.error("[FinanceReleaseBoard]", e);
      toast.error("Could not release order.");
    } finally {
      setActingId(null);
    }
  };

  if (!canAccess) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 text-center gap-3">
        <ShieldAlert size={44} className="text-muted-foreground" />
        <h2 className="font-display text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          This board is restricted to directors, administrators, CMD, and finance executives.
        </p>
      </div>
    );
  }

  if (loading && awaiting.length === 0 && ready.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground text-sm font-semibold uppercase tracking-wide">
          Loading Finance Board…
        </p>
      </div>
    );
  }

  const BadgeRow = ({
    payment_status,
    status,
  }: {
    payment_status: string | null;
    status: string;
  }) => (
    <div className="flex flex-wrap gap-1 mt-2">
      {payment_status && (
        <Badge variant="outline" className="text-[10px] capitalize">
          {payment_status.replace(/_/g, " ")}
        </Badge>
      )}
      <Badge variant="secondary" className="text-[10px] capitalize">
        {status.replace(/_/g, " ")}
      </Badge>
    </div>
  );

  const OrderCardInner = ({
    o,
    action,
  }: {
    o: BoardOrder;
    action?: ReactNode;
  }) => (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        SO #{o.id.slice(0, 8).toUpperCase()}
      </p>
      <p className="font-bold text-foreground mt-0.5">{o.company?.business_name ?? "—"}</p>
      <p className="text-lg font-black text-primary mt-1">{formatPrice(o.sales_order_value ?? 0)}</p>
      <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
        <span>
          Advance req: <strong className="text-foreground">{formatPrice(o.advance_required ?? 0)}</strong>
        </span>
        <span>
          Advance paid: <strong className="text-foreground">{formatPrice(o.advance_paid ?? 0)}</strong>
        </span>
      </div>
      {o.created_at && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {new Date(o.created_at).toLocaleDateString("en-IN")}
        </p>
      )}

      {/* Receipt Status - FIN-001 */}
      {o.payment_receipt_url ? (
        <a
          href={o.payment_receipt_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          📄 View Receipt
        </a>
      ) : (
        <p className="mt-2 text-xs font-semibold text-amber-600">⚠️ No receipt uploaded yet</p>
      )}

      <BadgeRow payment_status={o.payment_status} status={o.status} />
      {action}
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Finance Release Board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Golden pipeline gateway — receipts, approvals, and floor release.
        </p>
      </div>

      <Tabs defaultValue="awaiting" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
          <TabsTrigger value="awaiting" className="gap-1.5 text-xs">
            <Receipt size={14} /> Awaiting Finance Review
          </TabsTrigger>
          <TabsTrigger value="ready" className="gap-1.5 text-xs">
            <Package size={14} /> Ready for Operations
          </TabsTrigger>
          <TabsTrigger value="production" className="gap-1.5 text-xs">
            <Hammer size={14} /> In Production
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1.5 text-xs">
            <Truck size={14} /> Dispatch Ready
          </TabsTrigger>
        </TabsList>

        <TabsContent value="awaiting" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {awaiting.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing awaiting finance.</p>
            ) : (
              awaiting.map((o) => (
                <OrderCardInner
                  key={o.id}
                  o={o}
                  action={
                    <Button
                      className="mt-3 w-full"
                      variant="outline"
                      onClick={() => setReviewOrder(o)}
                    >
                      Review
                    </Button>
                  }
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="ready" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {ready.length === 0 ? (
              <p className="text-muted-foreground text-sm">No verified / credit-backed orders queued.</p>
            ) : (
              ready.map((o) => {
                const payOk = isReadyPaymentStatus(o.payment_status);
                const btnDisabled = !payOk || actingId === o.id;
                return (
                  <OrderCardInner
                    key={o.id}
                    o={o}
                    action={
                      <Button
                        className="mt-3 w-full bg-foreground text-background"
                        disabled={btnDisabled}
                        onClick={() => pushToFloor(o)}
                      >
                        {actingId === o.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          "Push to Floor"
                        )}
                      </Button>
                    }
                  />
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="production" className="mt-6 space-y-4">
          {inProduction.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders in production.</p>
          ) : (
            inProduction.map((o) => (
              <div key={o.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">
                      SO #{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="font-bold">{o.company?.business_name}</p>
                  </div>
                  <Badge variant="outline">in production</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/60 text-[10px] uppercase text-muted-foreground text-left">
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Actual packed</th>
                        <th className="px-3 py-2">Prod. status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itemsByOrderId[o.id] ?? []).map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{item.product?.name ?? "—"}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                          <td className="px-3 py-2">{item.actual_packed_qty ?? "—"}</td>
                          <td className="px-3 py-2 capitalize">
                            {(item.production_status ?? "—").replace(/_/g, " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="dispatch" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {dispatchReady.length === 0 ? (
              <p className="text-muted-foreground text-sm">No dispatched / partial shipments in this lane.</p>
            ) : (
              dispatchReady.map((o) => (
                <div key={o.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase">
                    SO #{o.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="font-bold">{o.company?.business_name}</p>
                  <Separator className="my-3" />
                  <p className="text-xs text-muted-foreground">
                    Tracking:{" "}
                    <span className="font-semibold text-foreground">
                      {(o.tracking_number || "").trim() || "—"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dispatched on:{" "}
                    <span className="font-semibold text-foreground">
                      {o.actual_despatch_date ? new Date(o.actual_despatch_date).toLocaleDateString("en-IN") : "—"}
                    </span>
                  </p>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewOrder} onOpenChange={(open) => !open && setReviewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Payment review #{reviewOrder?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <DialogDescription>
              Confirm against UTR references and uploaded proof before advancing the Golden Pipeline.
            </DialogDescription>
          </DialogHeader>
          {reviewOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase">Latest UTR (order_payments)</p>
                <p className="text-sm font-mono mt-1">{latestUtrByOrderId[reviewOrder.id] ?? "Loading…"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase">Receipt preview</p>
                {reviewOrder.payment_receipt_url ? (
                  <a
                    href={reviewOrder.payment_receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs font-semibold underline"
                  >
                    Open full receipt
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">No receipt file on record.</p>
                )}
                {reviewOrder.payment_receipt_url && /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(reviewOrder.payment_receipt_url) ? (
                  <img
                    src={reviewOrder.payment_receipt_url}
                    alt="Payment receipt"
                    className="mt-2 rounded-lg border border-border max-h-[220px] object-contain w-full bg-muted/30"
                  />
                ) : null}
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Reject reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Required only when rejecting payment…"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              disabled={!reviewOrder || actingId === reviewOrder.id}
              onClick={() => void runReject()}
            >
              {actingId && reviewOrder && actingId === reviewOrder.id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Reject"
              )}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!reviewOrder || actingId === reviewOrder?.id}
                onClick={() => void runVerifyAction("credit")}
              >
                Approve Credit
              </Button>
              <Button
                disabled={!reviewOrder || actingId === reviewOrder?.id}
                onClick={() => void runVerifyAction("verify")}
              >
                Verify
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceReleaseBoard;
