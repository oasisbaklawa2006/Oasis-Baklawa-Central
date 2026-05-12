import { useEffect, useMemo, useState } from "react";
import { Loader2, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  aggregateDepartmentLines,
  buildTimelineSteps,
  deriveDispatchBucket,
  deriveFinanceVisibility,
  deriveResponsibleDepartment,
  pendingRequisitionQty,
  type OrderTraceInputs,
} from "@/utils/orderTrace";

interface OrderTraceSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TraceOrderRow = Pick<
  OrderTraceInputs,
  "status" | "payment_status" | "advance_paid" | "advance_required" | "sales_order_value"
> & { id: string };

type TraceItemRow = {
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  product: {
    name: string;
    department: string | null;
    production_department: string | null;
  } | null;
};

type TraceReqRow = {
  id: string;
  status: string | null;
  target_store: string;
  store_requisition_items: {
    requested_qty: number;
    fulfilled_qty: number | null;
    product_id: string;
    product: { name: string } | null;
  }[];
};

type TraceJobRow = {
  id: string;
  department: string;
  status: string;
  assigned_qty: number;
  produced_qty: number | null;
};

function VisibilityChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
          : "inline-flex items-center rounded border border-transparent px-2 py-0.5 text-xs text-muted-foreground opacity-55"
      }
    >
      {label}
    </span>
  );
}

export default function OrderTraceSheet({ orderId, open, onOpenChange }: OrderTraceSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TraceOrderRow | null>(null);
  const [items, setItems] = useState<TraceItemRow[]>([]);
  const [reqs, setReqs] = useState<TraceReqRow[]>([]);
  const [jobs, setJobs] = useState<TraceJobRow[]>([]);

  useEffect(() => {
    if (!open || !orderId) {
      setOrder(null);
      setItems([]);
      setReqs([]);
      setJobs([]);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [orderRes, itemsRes, reqsRes, jobsRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, status, payment_status, advance_paid, advance_required, sales_order_value")
            .eq("id", orderId)
            .maybeSingle(),
          supabase
            .from("order_items")
            .select(
              "quantity, actual_packed_qty, production_status, department, product:products(name, department, production_department)",
            )
            .eq("order_id", orderId),
          supabase
            .from("store_requisitions")
            .select(
              "id, status, target_store, store_requisition_items(requested_qty, fulfilled_qty, product_id, product:products(name))",
            )
            .eq("order_id", orderId),
          supabase
            .from("production_jobs")
            .select("id, department, status, assigned_qty, produced_qty")
            .eq("order_id", orderId),
        ]);

        if (cancelled) return;

        if (orderRes.error) throw orderRes.error;
        if (!orderRes.data) {
          setOrder(null);
          setError("Order not found.");
          return;
        }

        setOrder(orderRes.data as TraceOrderRow);
        setItems((itemsRes.data as TraceItemRow[]) ?? []);
        setReqs((reqsRes.data as TraceReqRow[]) ?? []);
        setJobs((jobsRes.data as TraceJobRow[]) ?? []);

        if (itemsRes.error && process.env.NODE_ENV === "development") {
          console.warn("Order trace: order_items", itemsRes.error);
        }
        if (reqsRes.error && process.env.NODE_ENV === "development") {
          console.warn("Order trace: store_requisitions", reqsRes.error);
        }
        if (jobsRes.error && process.env.NODE_ENV === "development") {
          console.warn("Order trace: production_jobs", jobsRes.error);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load order trace";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const derived = useMemo(() => {
    if (!order) return null;

    const orderInputs: OrderTraceInputs = {
      status: order.status,
      payment_status: order.payment_status,
      advance_paid: order.advance_paid,
      advance_required: order.advance_required,
      sales_order_value: order.sales_order_value,
    };

    const finance = deriveFinanceVisibility(orderInputs);
    const dispatchBucket = deriveDispatchBucket(order.status, items);

    const deptAgg = aggregateDepartmentLines(items);
    const reqPending = pendingRequisitionQty(reqs);

    const totalOrdered = items.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalPacked = items.reduce((s, i) => s + (i.actual_packed_qty ?? 0), 0);
    const linesPackedRatio = totalOrdered > 0 ? totalPacked / totalOrdered : 0;

    const terminalJob = new Set(["completed", "cancelled"]);
    const hasOpenProductionJobs = jobs.some((j) => !terminalJob.has((j.status || "").toLowerCase()));

    const responsible = deriveResponsibleDepartment({
      orderStatus: order.status,
      pendingReqUnits: reqPending.pendingUnits,
      jobs,
      linesPackedRatio,
    });

    const timeline = buildTimelineSteps(orderInputs, reqPending.pendingUnits, hasOpenProductionJobs, linesPackedRatio);

    return {
      finance,
      dispatchBucket,
      deptAgg,
      reqPending,
      totalOrdered,
      totalPacked,
      responsible,
      timeline,
    };
  }, [order, items, reqs, jobs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Route size={18} />
            Order trace
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6 text-sm">
          {orderId && (
            <p className="font-mono text-xs text-muted-foreground">
              Order ID · {(orderId ?? "").slice(0, 8).toUpperCase()}
            </p>
          )}

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && error && <p className="text-destructive">{error}</p>}

          {!loading && !error && order && derived && (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</h3>
                <p>
                  <span className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">{order.status}</span>
                </p>
                <p className="text-foreground">
                  <span className="text-muted-foreground">Responsible · </span>
                  {derived.responsible}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Finance visibility</h3>
                <div className="flex flex-wrap gap-1.5">
                  <VisibilityChip label="awaiting_advance" active={derived.finance.awaiting_advance} />
                  <VisibilityChip label="advance_verified" active={derived.finance.advance_verified} />
                  <VisibilityChip label="balance_pending" active={derived.finance.balance_pending} />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dispatch visibility</h3>
                <VisibilityChip label={derived.dispatchBucket} active />
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order lines</h3>
                <p className="text-muted-foreground">
                  Packed{" "}
                  <span className="font-mono text-foreground">{derived.totalPacked}</span>
                  {" / "}
                  ordered <span className="font-mono text-foreground">{derived.totalOrdered}</span>
                  {" · "}
                  pending{" "}
                  <span className="font-mono text-foreground">{Math.max(0, derived.totalOrdered - derived.totalPacked)}</span>
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Department-wise lines
                </h3>
                {derived.deptAgg.length === 0 ? (
                  <p className="text-muted-foreground">No order lines.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-1.5 pr-2 font-medium">Department</th>
                        <th className="py-1.5 pr-2 font-medium">Lines</th>
                        <th className="py-1.5 pr-2 text-right font-medium">Ordered</th>
                        <th className="py-1.5 pr-2 text-right font-medium">Packed</th>
                        <th className="py-1.5 text-right font-medium">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derived.deptAgg.map((d) => (
                        <tr key={d.deptKey} className="border-b border-border last:border-0">
                          <td className="py-2 pr-2 align-top">
                            <div className="font-medium text-foreground">{d.deptKey}</div>
                            <div className="mt-0.5 text-muted-foreground">{d.productionSummary}</div>
                          </td>
                          <td className="py-2 pr-2 align-top font-mono">{d.lines}</td>
                          <td className="py-2 pr-2 align-top text-right font-mono">{d.orderedQty}</td>
                          <td className="py-2 pr-2 align-top text-right font-mono">{d.packedQty}</td>
                          <td className="py-2 align-top text-right font-mono">{d.pendingQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Store requisitions (pending qty)
                </h3>
                {reqs.length === 0 ? (
                  <p className="text-muted-foreground">No requisitions linked.</p>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Open lines{" "}
                      <span className="font-mono text-foreground">{derived.reqPending.pendingLines}</span>
                      {" · "}
                      pending units{" "}
                      <span className="font-mono text-foreground">{derived.reqPending.pendingUnits}</span>
                    </p>
                    <ul className="space-y-2 text-xs">
                      {reqs.map((r) => (
                        <li key={r.id} className="rounded border border-border p-2">
                          <div className="flex flex-wrap justify-between gap-1">
                            <span className="font-medium text-foreground">{r.target_store}</span>
                            <span className="text-muted-foreground">{r.status ?? "—"}</span>
                          </div>
                          <ul className="mt-1 space-y-0.5 text-muted-foreground">
                            {(r.store_requisition_items ?? []).map((li, liIdx) => {
                              const pend = Math.max(0, (li.requested_qty || 0) - (li.fulfilled_qty ?? 0));
                              if (pend <= 0) return null;
                              const name = li.product?.name ?? li.product_id.slice(0, 8);
                              return (
                                <li key={`${r.id}-${li.product_id}-${liIdx}`}>
                                  {name}{" "}
                                  <span className="font-mono text-foreground">
                                    −{pend}/{li.requested_qty}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Production jobs</h3>
                {jobs.length === 0 ? (
                  <p className="text-muted-foreground">No production jobs for this order.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {jobs.map((j) => (
                      <li key={j.id} className="flex justify-between gap-2 border-b border-border py-1 last:border-0">
                        <span className="text-foreground">{j.department.replace(/_/g, " ")}</span>
                        <span className="font-mono text-muted-foreground">
                          {j.status} · {j.produced_qty ?? 0}/{j.assigned_qty}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timeline (hint)</h3>
                <ol className="list-decimal space-y-1 pl-4 text-xs">
                  {derived.timeline.map((step) => (
                    <li
                      key={step.label}
                      className={
                        step.state === "current"
                          ? "font-medium text-foreground marker:text-primary"
                          : step.state === "done"
                            ? "text-muted-foreground"
                            : "text-muted-foreground/70"
                      }
                    >
                      {step.label}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
