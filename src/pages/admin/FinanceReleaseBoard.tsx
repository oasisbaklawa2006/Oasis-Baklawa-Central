import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/auth-routing";
import {
  releaseOrderToInProduction,
  updateOrderFinanceVerification,
  rejectOrderFinanceReview,
} from "@/lib/order-authority/orderAuthorityClient";
import {
  buildPaymentIdempotencyKey,
  buildPaymentCorrelationId,
  getPaymentFacts,
  rejectPayment,
  resolvePaymentBinding,
  verifyPayment,
} from "@/lib/order-authority/paymentAuthorityClient";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Receipt, Hammer, Truck, Package, RefreshCw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

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
  payment_rejection_reason: string | null;
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
  const [paymentIdByOrderId, setPaymentIdByOrderId] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pushConfirm, setPushConfirm] = useState<BoardOrder | null>(null);
  /** Prevents duplicate pushToFloor while the first invocation is still in flight (sync guard before actingId paints). */
  const pushFloorInFlightRef = useRef<string | null>(null);

  const canAccess = FINANCE_BOARD_ROLES.has(normalizedRole);

  const loadBoard = useCallback(async () => {
    if (!canAccess || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const baseSelect =
      "id, status, payment_status, sales_order_value, advance_required, advance_paid, created_at, payment_receipt_url, payment_rejection_reason, tracking_number, actual_despatch_date, company:companies(business_name)";

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

    const firstBoardErr = aq.error || rq.error || pq.error || dq.error;
    setLoadError(firstBoardErr ? firstBoardErr.message || "Could not refresh board data." : null);

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
    try {
      const binding = await resolvePaymentBinding(orderId);
      const facts = await getPaymentFacts(binding.piId);
      const pending = [...facts.payments].reverse().find((payment) => payment.status === "uploaded");
      setLatestUtrByOrderId((prev) => ({ ...prev, [orderId]: pending?.externalReference?.trim() || "—" }));
      setPaymentIdByOrderId((prev) => {
        const next = { ...prev };
        if (pending) next[orderId] = pending.paymentId;
        else delete next[orderId];
        return next;
      });
    } catch (error) {
      console.error("[FinanceReleaseBoard] canonical payment facts", error);
      setLatestUtrByOrderId((prev) => ({ ...prev, [orderId]: "Unavailable — governed PI/payment facts required" }));
      setPaymentIdByOrderId((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
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
      if (kind === "credit") {
        await updateOrderFinanceVerification(reviewOrder.id, "on_credit");
      } else {
        const paymentId = paymentIdByOrderId[reviewOrder.id];
        if (!paymentId || !reviewOrder.payment_receipt_url) {
          throw new Error("Canonical payment proof and governed payment facts are required before verification");
        }
        const binding = await resolvePaymentBinding(reviewOrder.id);
        const facts = await getPaymentFacts(binding.piId);
        const payment = facts.payments.find((candidate) => candidate.paymentId === paymentId && candidate.status === "uploaded");
        if (!payment) throw new Error("Payment proof is no longer pending verification");
        const correlationId = await buildPaymentCorrelationId("verify", paymentId);
        await verifyPayment({
          paymentId,
          verifiedAmount: payment.submittedAmount,
          verifiedReference: latestUtrByOrderId[reviewOrder.id] === "—" ? null : latestUtrByOrderId[reviewOrder.id],
          verificationEvidenceReference: reviewOrder.payment_receipt_url,
          reason: "Finance review",
          correlationId,
          idempotencyKey: await buildPaymentIdempotencyKey("verify", paymentId),
          actorId: user.id,
        });
      }
      toast.success(kind === "verify" ? "Payment verified." : "Credit approved.");
      setReviewOrder(null);
      await loadBoard();
    } catch (e) {
      console.error("[FinanceReleaseBoard]", e);
      toast.error(e instanceof Error ? e.message : "Could not update order.");
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
      if (reviewOrder.payment_status === "on_credit") {
        await rejectOrderFinanceReview(reviewOrder.id, trimmed);
      } else {
        const paymentId = paymentIdByOrderId[reviewOrder.id];
        if (!paymentId) throw new Error("Canonical payment facts are required before rejecting payment proof");
        const binding = await resolvePaymentBinding(reviewOrder.id);
        const facts = await getPaymentFacts(binding.piId);
        const payment = facts.payments.find((candidate) => candidate.paymentId === paymentId && candidate.status === "uploaded");
        if (!payment) {
          setPaymentIdByOrderId((prev) => {
            const next = { ...prev };
            delete next[reviewOrder.id];
            return next;
          });
          throw new Error("Payment proof is no longer pending rejection");
        }
        const correlationId = await buildPaymentCorrelationId("reject", paymentId);
        await rejectPayment({
          paymentId,
          reason: trimmed,
          correlationId,
          idempotencyKey: await buildPaymentIdempotencyKey("reject", paymentId),
          actorId: user.id,
        });
      }
      toast.success("Buyer asked to update payment receipt.");
      setReviewOrder(null);
      await loadBoard();
    } catch (e) {
      console.error("[FinanceReleaseBoard]", e);
      toast.error(e instanceof Error ? e.message : "Could not reject.");
    } finally {
      setActingId(null);
    }
  };

  const pushToFloor = async (order: BoardOrder) => {
    if (!isReadyPaymentStatus(order.payment_status)) return;
    if (!isReadyTabOrderStatus(order.status)) return;
    if (pushFloorInFlightRef.current === order.id) return;
    pushFloorInFlightRef.current = order.id;
    setActingId(order.id);
    try {
      await releaseOrderToInProduction(order.id, order.payment_status);
      toast.success("Released to factory floor.");
      setPushConfirm(null);
      await loadBoard();
    } catch (e) {
      console.error("[FinanceReleaseBoard]", e);
      toast.error(e instanceof Error ? e.message : "Could not release order.");
    } finally {
      setActingId(null);
      pushFloorInFlightRef.current = null;
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
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8" aria-busy="true" aria-label="Loading finance board">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-44 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <p className="text-center text-sm text-muted-foreground">Loading finance board…</p>
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
          onClick={(e) => {
            setTimeout(() => {
              if (window.document.body.textContent.includes("404") || window.document.body.textContent.includes("error")) {
                alert("Receipt file not accessible. It may have been deleted or failed to upload.");
              }
            }, 2000);
          }}
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
    <div className="mx-auto max-w-6xl space-y-6 px-3 sm:px-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">Finance Release Board</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Golden pipeline gateway — receipts, approvals, and floor release.
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-destructive">Some board data could not be loaded</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{loadError}</p>
            <p className="mt-1 text-xs text-muted-foreground">You can retry; sections that succeeded may still show below.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 touch-manipulation gap-2 border-destructive/40"
            onClick={() => void loadBoard()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Refreshing…</p>
      ) : null}

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
          <div className="grid gap-4 sm:grid-cols-2">
            {awaiting.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center sm:col-span-2"
                role="status"
              >
                <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden />
                <p className="font-medium text-foreground">Nothing awaiting finance review</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  When buyers submit receipts or payments move to review, orders appear here automatically.
                </p>
              </div>
            ) : (
              awaiting.map((o) => (
                <OrderCardInner
                  key={o.id}
                  o={o}
                  action={
                    <Button
                      className="mt-3 w-full min-h-11 touch-manipulation"
                      variant="outline"
                      onClick={() => setReviewOrder(o)}
                      aria-label={`Review payment for order ${o.id.slice(0, 8).toUpperCase()}`}
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
          <div className="grid gap-4 sm:grid-cols-2">
            {ready.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center sm:col-span-2"
                role="status"
              >
                <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden />
                <p className="font-medium text-foreground">No orders queued for floor release</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Verified or credit-backed orders in submitted / approved status will show here for release.
                </p>
              </div>
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
                        className="mt-3 w-full min-h-11 touch-manipulation bg-foreground text-background"
                        disabled={btnDisabled}
                        onClick={() => setPushConfirm(o)}
                        aria-label={`Release order ${o.id.slice(0, 8).toUpperCase()} to factory floor`}
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
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center" role="status">
              <Hammer className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden />
              <p className="font-medium text-foreground">No orders in production</p>
              <p className="mt-2 text-sm text-muted-foreground">Released orders appear here with line packing status.</p>
            </div>
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
                <div className="md:hidden space-y-2 border-t border-border p-3">
                  {(itemsByOrderId[o.id] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No line items loaded.</p>
                  ) : (
                    (itemsByOrderId[o.id] ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border/80 bg-muted/10 p-3 text-sm shadow-sm"
                      >
                        <p className="font-semibold leading-snug text-foreground break-words">
                          {item.product?.name ?? "—"}
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                          <div>
                            <p className="font-medium uppercase tracking-wide">Qty</p>
                            <p className="font-number text-base font-semibold text-foreground">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="font-medium uppercase tracking-wide">Packed</p>
                            <p className="font-number text-base font-semibold text-foreground">
                              {item.actual_packed_qty ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium uppercase tracking-wide">Status</p>
                            <p className="capitalize text-foreground">
                              {(item.production_status ?? "—").replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden md:block overflow-x-auto overscroll-x-contain">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="sticky top-0 z-[1] bg-muted/90 shadow-sm backdrop-blur-sm">
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
                          <td className="px-3 py-2 font-medium break-words">{item.product?.name ?? "—"}</td>
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
          <div className="grid gap-4 sm:grid-cols-2">
            {dispatchReady.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center sm:col-span-2"
                role="status"
              >
                <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden />
                <p className="font-medium text-foreground">No shipments in this lane</p>
                <p className="mt-2 text-sm text-muted-foreground">Dispatched and partially fulfilled orders surface here.</p>
              </div>
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
        <DialogContent className="flex max-h-[min(92dvh,100%)] w-[calc(100vw-1.25rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 space-y-1.5 border-b border-border px-6 pb-4 pt-6 pr-14 text-left">
            <DialogTitle>
              Payment review #{reviewOrder?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <DialogDescription>
              Confirm against UTR references and uploaded proof before advancing the Golden Pipeline.
            </DialogDescription>
          </DialogHeader>
          {reviewOrder && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-4">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase">Latest UTR (Core payment facts)</p>
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
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-between sm:gap-3 sm:space-x-0">
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Irreversible buyer action</p>
              <Button
                variant="outline"
                className="min-h-11 w-full touch-manipulation border-destructive/50 text-destructive hover:bg-destructive/10 sm:w-auto"
                disabled={!reviewOrder || actingId === reviewOrder.id}
                onClick={() => void runReject()}
                aria-label="Reject payment and send buyer back for receipt"
              >
              {actingId && reviewOrder && actingId === reviewOrder.id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Reject"
              )}
              </Button>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="secondary"
                className="min-h-11 w-full touch-manipulation sm:w-auto"
                disabled={!reviewOrder || actingId === reviewOrder?.id}
                onClick={() => void runVerifyAction("credit")}
              >
                Approve Credit
              </Button>
              <Button
                className="min-h-11 w-full touch-manipulation sm:w-auto"
                disabled={!reviewOrder || actingId === reviewOrder?.id}
                onClick={() => void runVerifyAction("verify")}
              >
                Verify
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pushConfirm}
        onOpenChange={(open) => {
          if (!open) setPushConfirm(null);
        }}
      >
        <DialogContent className="flex max-h-[min(88dvh,100%)] w-[calc(100vw-1.25rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6 pr-14 text-left">
            <DialogTitle>Release to factory floor?</DialogTitle>
            <DialogDescription>
              {pushConfirm ? (
                <>
                  Order <span className="font-mono font-semibold text-foreground">#{pushConfirm.id.slice(0, 8).toUpperCase()}</span>{" "}
                  for <span className="font-medium text-foreground">{pushConfirm.company?.business_name ?? "—"}</span> will move to{" "}
                  <strong>in production</strong>. Confirm packing and finance checks are complete.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end sm:gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="min-h-11 w-full touch-manipulation sm:w-auto" onClick={() => setPushConfirm(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 w-full touch-manipulation bg-foreground text-background sm:w-auto"
              disabled={!pushConfirm || actingId === pushConfirm.id}
              onClick={() => {
                const o = pushConfirm;
                if (!o) return;
                void pushToFloor(o);
              }}
            >
              {pushConfirm && actingId === pushConfirm.id ? <Loader2 size={16} className="animate-spin" /> : "Confirm release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceReleaseBoard;
