import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Search, ShieldCheck, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createDispatchReadinessBundle, type DispatchReadinessBundle } from "@/lib/dispatch-readiness/createDispatchReadinessBundle";
import { createFinanceGovernanceBundle, type FinanceGovernanceBundle } from "@/lib/finance-governance/createFinanceGovernanceBundle";
import { createDispatchCompletionBundle, type DispatchCompletionBundle } from "@/lib/dispatch-completion/createDispatchCompletionBundle";
import {
  createDispatchFinalizationBundle,
  type DispatchFinalizationBundle,
} from "@/lib/dispatch-finalization/createDispatchFinalizationBundle";
import { DispatchFinalizationError } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import { createStockFinalizationBundle, type StockFinalizationBundle } from "@/lib/stock-finalization/createStockFinalizationBundle";
import { createAndReserveInventoryForOrder } from "@/lib/inventory-reservations/createGovernedReservation";
import { loadOrderLinesForReservation } from "@/lib/inventory-reservations/reservationBoardQueries";
import { createSupabaseStockBalanceRepository } from "@/lib/stock-finalization/supabaseStockFinalizationStore";
import { dispatchFinalizeGuardMessage } from "@/lib/golden-chain-operator/goldenChainDuplicateGuards";
import {
  goldenChainAdvancedPastDispatchFinalize,
  loadGoldenChainOrderState,
  normalizeGoldenChainStateAfterDispatchFinalize,
  prepareDispatchEvidenceForOrder,
  reloadGoldenChainOrderWithRetry,
  goldenChainReloadSatisfiedAfterDispatchFinalize,
  searchGoldenChainOrders,
  type GoldenChainOrderState,
  type GoldenChainOrderSummary,
} from "@/lib/golden-chain-operator";
import { GOLDEN_CHAIN_STAGES } from "@/lib/golden-chain-operator/goldenChainTypes";
import { formatSalesOrderLabel } from "@/utils/orderSoLabel";
import { cn } from "@/lib/utils";
import { requiresStockOverrideReason } from "@/lib/stock-authority/stockAuthorityGuard";
import { ReservationError } from "@/lib/inventory-reservations/reservationTypes";
import {
  GOLDEN_CHAIN_RESERVATION_DENIED_MESSAGE,
  goldenChainReservationWriteContext,
  goldenChainUserCanReserveStock,
  orderHasActiveReservedStock,
} from "@/lib/golden-chain-operator/goldenChainReservationAccess";

const PROGRESS_STEPS = [
  { key: "prepare_dispatch_evidence", label: "Prepare evidence" },
  { key: "finance_release", label: "Finance" },
  { key: "readiness_review", label: "Readiness" },
  { key: "completion_attestation", label: "Completion" },
  { key: "dispatch_finalization", label: "Finalize" },
  { key: "reservation", label: "Reserve" },
  { key: "stock_finalization", label: "Stock" },
  { key: "complete", label: "Done" },
] as const;

function stageIndex(stage: string): number {
  const i = GOLDEN_CHAIN_STAGES.indexOf(stage as (typeof GOLDEN_CHAIN_STAGES)[number]);
  return i >= 0 ? i : 0;
}

export default function GoldenChainOperatorWizard() {
  const { user, role } = useAuth();
  const [search, setSearch] = useState("");
  const [summaries, setSummaries] = useState<GoldenChainOrderSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<GoldenChainOrderState | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const [readinessBundle, setReadinessBundle] = useState<DispatchReadinessBundle | null>(null);
  const [financeBundle, setFinanceBundle] = useState<FinanceGovernanceBundle | null>(null);
  const [completionBundle, setCompletionBundle] = useState<DispatchCompletionBundle | null>(null);
  const [finalizationBundle, setFinalizationBundle] = useState<DispatchFinalizationBundle | null>(null);
  const [stockBundle, setStockBundle] = useState<StockFinalizationBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      createDispatchReadinessBundle(supabase),
      createFinanceGovernanceBundle(supabase),
      createDispatchCompletionBundle(supabase),
      createDispatchFinalizationBundle(supabase),
      createStockFinalizationBundle(supabase),
    ]).then(([r, f, c, fin, s]) => {
      if (cancelled) return;
      setReadinessBundle(r);
      setFinanceBundle(f);
      setCompletionBundle(c);
      setStockBundle(s);
      setFinalizationBundle(fin);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await searchGoldenChainOrders(supabase, search);
      setSummaries(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not search orders");
      setSummaries([]);
    } finally {
      setLoadingList(false);
    }
  }, [search]);

  const reloadOrder = useCallback(async (orderId: string) => {
    setLoadingOrder(true);
    try {
      const next = await loadGoldenChainOrderState(supabase, orderId);
      setState(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load order");
      setState(null);
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void reloadList(), 400);
    return () => window.clearTimeout(t);
  }, [reloadList]);

  useEffect(() => {
    if (selectedId) void reloadOrder(selectedId);
    else setState(null);
  }, [selectedId, reloadOrder]);

  const viewState = useMemo(
    () => (state ? normalizeGoldenChainStateAfterDispatchFinalize(state) : null),
    [state],
  );

  useEffect(() => {
    if (!state) return;
    const normalized = normalizeGoldenChainStateAfterDispatchFinalize(state);
    if (normalized.stage !== state.stage || normalized.cta !== state.cta) {
      setState(normalized);
    }
  }, [state]);

  const writeCtx = (prefix: string) => ({
    correlationId: `golden-chain-${prefix}-${Date.now()}`,
    actorUserId: user?.id ?? "",
    actorRole: role ?? "DISPATCH_MANAGER",
    actorDepartment: "golden_chain_operator",
    overrideReason: overrideReason.trim() || null,
    attestationReason: overrideReason.trim() || "Operator confirmed dispatch check",
    finalizeReason: state?.evidenceRefs.stockFinalizeReason ?? "Golden chain operator",
    rejectionReason: null,
  });

  const finalizeGuardMsg =
    viewState?.dispatchAlreadyFinalized && viewState.stage === "dispatch_finalization"
      ? dispatchFinalizeGuardMessage(viewState.dispatchLineage)
      : null;

  const primaryDisabled = useMemo(() => {
    if (busy || !viewState || loadingOrder) return true;
    if (
      viewState.cta === "Already complete" ||
      viewState.cta === "Completion already attested" ||
      viewState.stage === "complete"
    ) {
      return true;
    }
    if (viewState.stage === "dispatch_finalization" && viewState.dispatchAlreadyFinalized) return true;
    if (
      (viewState.stage === "prepare_dispatch_evidence" || viewState.stage === "readiness_review") &&
      !readinessBundle?.canExecuteWrites
    ) {
      return true;
    }
    if (viewState.stage === "finance_release" && !financeBundle?.canExecuteWrites) return true;
    if (viewState.stage === "completion_attestation" && !completionBundle?.canExecuteWrites) return true;
    if (viewState.stage === "dispatch_finalization" && !finalizationBundle?.canExecuteWrites) return true;
    if (viewState.stage === "stock_finalization" && !stockBundle?.canExecuteWrites) return true;
    if (viewState.stage === "reservation" && !goldenChainUserCanReserveStock(role)) return true;
    if (
      viewState.stage === "stock_finalization" &&
      requiresStockOverrideReason(role) &&
      !overrideReason.trim()
    ) {
      return true;
    }
    return false;
  }, [
    busy,
    viewState,
    loadingOrder,
    readinessBundle,
    financeBundle,
    completionBundle,
    finalizationBundle,
    stockBundle,
    role,
    overrideReason,
  ]);

  const progressIdx = viewState ? stageIndex(viewState.stage) : -1;

  async function runPrimaryAction() {
    if (!state || primaryDisabled) return;
    const actionStage = viewState?.stage ?? state.stage;
    setBusy(true);
    const refs = state.evidenceRefs;
    const ctxBase = writeCtx(actionStage);
    const prevCta = state.cta;
    const stageBeforeAction = actionStage;
    let dispatchFinalizeSucceeded = false;

    try {
      switch (actionStage) {
        case "prepare_dispatch_evidence": {
          if (!readinessBundle) throw new Error("Dispatch check service is unavailable. Try again or call IT.");
          const prep = await prepareDispatchEvidenceForOrder(supabase, {
            orderId: state.orderId,
            evidenceSlices: state.readinessEvidenceSlices,
            scan: state.scanSlice,
            refs,
            readinessBundle,
            ctx: ctxBase,
          });
          const allSkipped =
            prep.added.length === 0 && prep.scanRecorded.length === 0 && prep.skipped.length > 0;
          if (allSkipped) {
            toast.info("Already recorded — all dispatch evidence and scans are present.");
          } else if (prep.skipped.length > 0) {
            toast.info(
              `Recorded: ${[...prep.added, ...prep.scanRecorded].join(", ") || "none"}. Already had: ${prep.skipped.join(", ")}.`,
            );
          }
          break;
        }
        case "finance_release": {
          if (!financeBundle?.service) throw new Error("Finance approval service is unavailable.");
          const financeInput = {
            ...state.financeInput,
            reservationReady: true,
            dispatchReadinessGateEligible:
              state.dispatchEvidencePrepared || state.readinessInput.packingEvidenceVerified,
          };
          await financeBundle.service.commercialRelease(financeInput, {
            ...ctxBase,
            actorRole: role ?? "FINANCE_HEAD",
          });
          break;
        }
        case "readiness_review": {
          if (!readinessBundle?.service) throw new Error("Dispatch check service is unavailable.");
          const readinessState = await loadGoldenChainOrderState(supabase, state.orderId);
          if (!readinessState) {
            throw new Error("Order state could not be refreshed before readiness review.");
          }
          const reviewInput = {
            ...readinessState.readinessInput,
            readinessPolicy: "pre_dispatch" as const,
          };
          const { projection } = await readinessBundle.service.reviewReadiness(reviewInput, ctxBase);
          if (projection.readinessStatus !== "gate_eligible") {
            throw new Error(
              projection.blockingReasons[0] ??
                "Readiness review did not reach gate eligible — resolve blockers and try again.",
            );
          }
          break;
        }
        case "completion_attestation": {
          if (!completionBundle?.service) throw new Error("Completion confirmation service is unavailable.");
          if (state.cta === "Completion already attested") {
            toast.info("Completion already attested.");
            break;
          }
          try {
            await completionBundle.service.attestCompletion(state.completionInput, {
              ...ctxBase,
              attestationReason: ctxBase.attestationReason,
            });
          } catch (e) {
            if (e instanceof Error && /already attested/i.test(e.message)) {
              toast.info("Completion already attested.");
              break;
            }
            throw e;
          }
          break;
        }
        case "dispatch_finalization": {
          if (state.dispatchAlreadyFinalized) {
            toast.info(
              finalizeGuardMsg ?? "Dispatch was already finalized. Continue to reserve stock.",
            );
            break;
          }
          if (!finalizationBundle?.service) throw new Error("Dispatch finalize service is unavailable.");
          const input = {
            ...state.finalizationInput,
            gateReference: state.finalizationInput.gateReference?.trim() || refs.gateScanRef,
            completionReference:
              state.finalizationInput.completionReference?.trim() || refs.gateScanRef,
            transporterReference:
              state.finalizationInput.transporterReference?.trim() || refs.transporterRef,
          };
          const advanceAfterFinalize = () => {
            dispatchFinalizeSucceeded = true;
            setState(
              normalizeGoldenChainStateAfterDispatchFinalize({
                ...state,
                orderStatus: "dispatched",
                dispatchAlreadyFinalized: true,
                dispatchLineage: [
                  {
                    releaseType: "finalize",
                    nextStatus: "dispatched",
                    createdAt: new Date().toISOString(),
                  },
                  ...state.dispatchLineage,
                ],
                finalizationInput: {
                  ...state.finalizationInput,
                  currentOrderStatus: "dispatched",
                },
              }),
            );
          };
          try {
            await finalizationBundle.service.finalizeDispatch(input, {
              ...ctxBase,
              actorRole: role ?? "DISPATCH_HEAD",
              finalizeReason: refs.stockFinalizeReason,
            });
            advanceAfterFinalize();
          } catch (e) {
            if (e instanceof DispatchFinalizationError && e.code === "already_finalized") {
              const refreshed = await loadGoldenChainOrderState(supabase, state.orderId);
              if (
                refreshed &&
                ["dispatched", "in_transit", "delivered"].includes(
                  refreshed.orderStatus.trim().toLowerCase(),
                )
              ) {
                advanceAfterFinalize();
              } else {
                throw e;
              }
            } else {
              const refreshed = await loadGoldenChainOrderState(supabase, state.orderId);
              if (
                refreshed &&
                ["dispatched", "in_transit", "delivered"].includes(
                  refreshed.orderStatus.trim().toLowerCase(),
                )
              ) {
                advanceAfterFinalize();
              } else {
                throw e;
              }
            }
          }
          break;
        }
        case "reservation": {
          if (!goldenChainUserCanReserveStock(role)) {
            throw new Error(GOLDEN_CHAIN_RESERVATION_DENIED_MESSAGE);
          }
          if (orderHasActiveReservedStock(state.reservations)) {
            toast.info("Stock already reserved for this order.");
            break;
          }
          const lines =
            state.orderLines.length > 0
              ? state.orderLines
              : await loadOrderLinesForReservation(supabase, state.orderId);
          const line = lines[0];
          if (!line) throw new Error("No product lines on this order — cannot reserve stock.");
          for (const item of lines) {
            await createAndReserveInventoryForOrder(
              supabase,
              {
                orderId: state.orderId,
                productId: item.productId,
                sku: item.sku,
                quantity: item.quantity,
                locationCode: "WH-MAIN",
                sourceDepartment: "golden_chain_operator",
              },
              goldenChainReservationWriteContext({
                correlationId: `${ctxBase.correlationId}-${item.sku}`,
                actorUserId: ctxBase.actorUserId,
                actorRole: ctxBase.actorRole,
                actorDepartment: "golden_chain_operator",
              }),
            );
          }
          break;
        }
        case "stock_finalization": {
          if (!stockBundle?.service || !state.stockInput) {
            throw new Error("Stock deduction service is unavailable.");
          }
          const activeReservations = state.stockInput.reservations.filter(
            (r) => r.reservedQty > 0 && r.fulfilledQty < r.requestedQty,
          );
          const reservation = activeReservations[0] ?? state.stockInput.reservations[0];
          if (!reservation) {
            throw new Error("No stock reservation found. Complete “Reserve stock” first.");
          }
          const scanRef = state.stockInput.scanReference?.trim() || refs.gateScanRef;
          if (!scanRef) {
            throw new Error(
              "Gate scan is missing. Scan carton at Security Gate or ask dispatch supervisor.",
            );
          }
          let expectedBalanceVersion = 1;
          if (stockBundle.persistenceMode === "supabase") {
            const balances = createSupabaseStockBalanceRepository(supabase);
            const balanceRow = await balances.getBalance(
              reservation.productId,
              reservation.sku,
              state.stockInput.locationCode,
            );
            if (balanceRow) expectedBalanceVersion = balanceRow.version;
          }
          await stockBundle.service.finalizeConsumption(
            {
              ...state.stockInput,
              reservations: state.reservations,
            },
            {
              orderId: state.orderId,
              scanReference: scanRef,
              gateReference: state.stockInput.gateReference ?? refs.gateScanRef,
              dispatchLineageId: state.stockInput.dispatchLineageId,
              items: activeReservations.length
                ? activeReservations.map((r) => ({
                    reservationId: r.id,
                    productId: r.productId,
                    sku: r.sku,
                    locationCode: state.stockInput!.locationCode,
                    consumeQty: r.reservedQty || r.requestedQty,
                    expectedBalanceVersion,
                  }))
                : [
                    {
                      reservationId: reservation.id,
                      productId: reservation.productId,
                      sku: reservation.sku,
                      locationCode: state.stockInput.locationCode,
                      consumeQty: reservation.reservedQty || reservation.requestedQty,
                      expectedBalanceVersion,
                    },
                  ],
            },
            {
              correlationId: ctxBase.correlationId,
              actorUserId: ctxBase.actorUserId,
              actorRole: ctxBase.actorRole,
              finalizeReason: refs.stockFinalizeReason,
              overrideReason: role === "SUPER_ADMIN" ? overrideReason.trim() : null,
              reservationWriteChannel: "golden_chain_operator",
            },
          );
          break;
        }
        default:
          break;
      }

      if (dispatchFinalizeSucceeded) {
        const reloaded = await reloadGoldenChainOrderWithRetry(
          supabase,
          state.orderId,
          (loaded) =>
            goldenChainReloadSatisfiedAfterDispatchFinalize(
              normalizeGoldenChainStateAfterDispatchFinalize(loaded),
            ),
          { maxAttempts: 20, delayMs: 500 },
        );
        const next = normalizeGoldenChainStateAfterDispatchFinalize(reloaded);
        if (
          !["dispatched", "in_transit", "delivered"].includes(next.orderStatus.trim().toLowerCase())
        ) {
          throw new Error("Dispatch finalize did not persist orders.status=dispatched");
        }
        setState(next);
        await reloadList();
        toast.success("Dispatch finalized. Continue to reserve stock.");
        return;
      }

      await reloadList();
      const next = await loadGoldenChainOrderState(supabase, state.orderId);
      setState(next);

      const stageAdvanced = next.stage !== stageBeforeAction;
      const ctaAdvanced = next.cta !== prevCta;
      const stockFinalized =
        stageBeforeAction === "stock_finalization" &&
        (next.stage === "complete" || next.stockConsumptionComplete);
      if (stageAdvanced || ctaAdvanced || stockFinalized) {
        toast.success(`${prevCta} completed. Next: ${next.cta}`);
      } else if (stageBeforeAction === "prepare_dispatch_evidence") {
        toast.warning("Evidence recorded but prerequisites still missing — check blockers below.");
      } else {
        toast.error("Step did not advance — resolve blockers and try again.");
      }
    } catch (e) {
      const msg =
        e instanceof ReservationError && e.code === "authority_denied"
          ? GOLDEN_CHAIN_RESERVATION_DENIED_MESSAGE
          : e instanceof Error
            ? e.message
            : "Action failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 pb-32">
      <header className="space-y-1 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Workflow className="h-7 w-7 text-primary shrink-0" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Golden Chain Operator</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Select one order, then complete the single next step shown. No payment or customer messages from this screen.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Find order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="SO-2026-000115 or last digits of order id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-base"
              aria-label="Search orders"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10 shrink-0"
              onClick={() => void reloadList()}
              disabled={loadingList}
              aria-label="Search"
            >
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-1">
            {summaries.length === 0 && !loadingList && (
              <p className="p-2 text-xs text-muted-foreground">No matching orders. Try an SO number.</p>
            )}
            {summaries.map((row) => (
              <button
                key={row.orderId}
                type="button"
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted min-h-[44px]",
                  selectedId === row.orderId && "bg-muted ring-1 ring-primary/40",
                )}
                onClick={() => setSelectedId(row.orderId)}
              >
                <span className="font-medium">{row.orderNumber ?? `Order …${row.orderId.slice(-4)}`}</span>
                <span className="text-xs text-muted-foreground">
                  {row.orderStatus} · {row.governanceStageLabel} · {row.nextAction}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loadingOrder && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading order…
        </p>
      )}

      {state && !loadingOrder && (
        <>
          <Card className="sticky top-0 z-10 shadow-sm ring-1 ring-border/60">
            <CardContent className="space-y-3 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold leading-tight">
                    {formatSalesOrderLabel({ id: state.orderId, order_number: state.orderNumber })}
                  </p>
                  {state.companyName && (
                    <p className="text-sm text-muted-foreground">{state.companyName}</p>
                  )}
                </div>
                <Badge variant={viewState?.stage === "complete" ? "default" : "secondary"}>
                  {state.staffStageLabel}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Status: {state.orderStatus}</span>
                <span>Payment: {state.paymentStatus ?? "—"}</span>
              </div>
              <p className="text-sm">
                <span className="font-medium text-foreground">Waiting on: </span>
                {state.whoMustActNext}
              </p>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {PROGRESS_STEPS.map((step, i) => {
                  const done = progressIdx > i || viewState?.stage === "complete";
                  const current = viewState?.stage === step.key;
                  return (
                    <div
                      key={step.key}
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium",
                        done && "bg-primary/15 text-primary",
                        current && !done && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
                        !done && !current && "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {step.label}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {state.orderLines.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Product lines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {state.orderLines.map((line) => (
                  <p key={`${line.productId}-${line.sku}`}>
                    {line.productName ?? line.sku} · {line.sku} × {line.quantity}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {state.blockers.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="space-y-2 pt-4">
                <p className="text-sm font-medium text-destructive">What is blocking progress</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {state.blockers.map((b, i) => (
                    <li key={`${b.message}-${i}`}>{b.message}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {finalizeGuardMsg && viewState?.stage === "dispatch_finalization" && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              {finalizeGuardMsg}
            </p>
          )}

          {viewState?.stage === "reservation" && !goldenChainUserCanReserveStock(role) && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              {GOLDEN_CHAIN_RESERVATION_DENIED_MESSAGE}
            </p>
          )}

          {viewState?.stage === "stock_finalization" && requiresStockOverrideReason(role) && (
            <div className="space-y-2">
              <Label htmlFor="override-reason" className="text-sm">
                Override reason (required for stock deduction)
              </Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why a manual stock override is needed"
                className="min-h-[72px] text-base"
              />
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <Button
              type="button"
              className="h-12 w-full text-base font-semibold"
              disabled={primaryDisabled}
              onClick={() => void runPrimaryAction()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Working…
                </>
              ) : (
                viewState?.cta ?? state.cta
              )}
            </Button>
            {viewState?.stage === "dispatch_finalization" && viewState.dispatchAlreadyFinalized && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Dispatch already finalized — select another step after refresh.
              </p>
            )}
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-between text-xs text-muted-foreground"
            onClick={() => setShowAudit((v) => !v)}
          >
            Audit details
            {showAudit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showAudit && (
            <Card>
              <CardContent className="space-y-1 pt-4 font-mono text-[11px] text-muted-foreground">
                <p>packing: {state.evidenceRefs.packingPhotoRef}</p>
                <p>document: {state.evidenceRefs.documentPlaceholderRef}</p>
                <p>gate: {state.evidenceRefs.gateScanRef}</p>
                <p>handoff: {state.evidenceRefs.transporterRef}</p>
                <p>stock reason: {state.evidenceRefs.stockFinalizeReason}</p>
                <p className="pt-2">
                  Supervisors:{" "}
                  <Link to="/admin/dispatch-readiness" className="underline">
                    advanced boards
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!state && !loadingOrder && selectedId && (
        <p className="text-sm text-muted-foreground">Could not load the selected order.</p>
      )}

      <p className="text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        Advanced audit boards remain available to supervisors under Operations (dispatch readiness, finance governance, etc.).
      </p>
    </div>
  );
}
