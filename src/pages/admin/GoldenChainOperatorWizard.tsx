import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, ShieldCheck, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GovernancePrerequisiteList } from "@/components/admin/GovernancePrerequisiteList";
import { createDispatchReadinessBundle, type DispatchReadinessBundle } from "@/lib/dispatch-readiness/createDispatchReadinessBundle";
import { createFinanceGovernanceBundle, type FinanceGovernanceBundle } from "@/lib/finance-governance/createFinanceGovernanceBundle";
import { createDispatchCompletionBundle, type DispatchCompletionBundle } from "@/lib/dispatch-completion/createDispatchCompletionBundle";
import {
  createDispatchFinalizationBundle,
  type DispatchFinalizationBundle,
} from "@/lib/dispatch-finalization/createDispatchFinalizationBundle";
import { createStockFinalizationBundle, type StockFinalizationBundle } from "@/lib/stock-finalization/createStockFinalizationBundle";
import { createAndReserveInventoryForOrder } from "@/lib/inventory-reservations/createGovernedReservation";
import { loadOrderLinesForReservation } from "@/lib/inventory-reservations/reservationBoardQueries";
import { createSupabaseStockBalanceRepository } from "@/lib/stock-finalization/supabaseStockFinalizationStore";
import { dispatchFinalizeGuardMessage } from "@/lib/golden-chain-operator/goldenChainDuplicateGuards";
import {
  loadGoldenChainOrderState,
  searchGoldenChainOrders,
  type GoldenChainOrderState,
  type GoldenChainOrderSummary,
} from "@/lib/golden-chain-operator";
import { governanceStageLabel } from "@/lib/golden-chain-operator/goldenChainStageDerivation";
import { formatSalesOrderLabel } from "@/utils/orderSoLabel";

export default function GoldenChainOperatorWizard() {
  const { user, role } = useAuth();
  const [search, setSearch] = useState("");
  const [summaries, setSummaries] = useState<GoldenChainOrderSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<GoldenChainOrderState | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      setFinalizationBundle(fin);
      setStockBundle(s);
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
      setMessage(e instanceof Error ? e.message : "Search failed");
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
      setMessage(e instanceof Error ? e.message : "Failed to load order");
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

  const writeCtx = (prefix: string) => ({
    correlationId: `golden-chain-${prefix}-${Date.now()}`,
    actorUserId: user?.id ?? "",
    actorRole: role ?? "DISPATCH_MANAGER",
    actorDepartment: "golden_chain_operator",
    overrideReason: state?.evidenceRefs.overrideReason ?? null,
    attestationReason: state?.evidenceRefs.overrideReason,
    finalizeReason: "Golden chain operator wizard",
    rejectionReason: null,
  });

  const finalizeDisabled = useMemo(() => {
    if (!state) return true;
    if (state.stage === "4e_dispatch_finalization" && state.dispatchAlreadyFinalized) return true;
    if (state.cta === "Already complete") return true;
    return false;
  }, [state]);

  const primaryDisabled =
    busy ||
    !state ||
    finalizeDisabled ||
    state.cta === "Already complete" ||
    (state.stage === "4b_readiness" && !readinessBundle?.canExecuteWrites) ||
    (state.stage === "4c_finance" && !financeBundle?.canExecuteWrites) ||
    (state.stage === "4d_completion" && !completionBundle?.canExecuteWrites) ||
    (state.stage === "4e_dispatch_finalization" && !finalizationBundle?.canExecuteWrites) ||
    (state.stage === "4g_stock" && !stockBundle?.canExecuteWrites);

  async function runPrimaryAction() {
    if (!state || primaryDisabled) return;
    setBusy(true);
    setMessage(null);
    const refs = state.evidenceRefs;
    const ctxBase = writeCtx(state.stage);

    try {
      switch (state.stage) {
        case "4b_readiness": {
          if (!readinessBundle?.service) throw new Error("Readiness service unavailable");
          await readinessBundle.service.addEvidence(
            {
              orderId: state.orderId,
              queueItemId: null,
              evidenceType: "packing_photo",
              evidenceStatus: "verified",
              evidenceRef: refs.packingPhotoRef,
              photoRef: refs.packingPhotoRef,
              documentRef: null,
              barcodeRef: null,
            },
            ctxBase,
          );
          await readinessBundle.service.addEvidence(
            {
              orderId: state.orderId,
              queueItemId: null,
              evidenceType: "document_placeholder",
              evidenceStatus: "verified",
              evidenceRef: refs.documentPlaceholderRef,
              photoRef: null,
              documentRef: refs.documentPlaceholderRef,
              barcodeRef: null,
            },
            ctxBase,
          );
          await readinessBundle.service.addEvidence(
            {
              orderId: state.orderId,
              queueItemId: null,
              evidenceType: "gate_scan",
              evidenceStatus: "verified",
              evidenceRef: refs.gateScanRef,
              photoRef: null,
              documentRef: null,
              barcodeRef: refs.gateScanRef,
            },
            ctxBase,
          );
          await readinessBundle.service.reviewReadiness(state.readinessInput, ctxBase);
          break;
        }
        case "4c_finance": {
          if (!financeBundle?.service) throw new Error("Finance service unavailable");
          await financeBundle.service.commercialRelease(state.financeInput, {
            ...ctxBase,
            actorRole: role ?? "FINANCE_HEAD",
          });
          break;
        }
        case "4d_completion": {
          if (!completionBundle?.service) throw new Error("Completion service unavailable");
          await completionBundle.service.attestCompletion(state.completionInput, {
            ...ctxBase,
            attestationReason: refs.overrideReason,
          });
          break;
        }
        case "4e_dispatch_finalization": {
          if (state.dispatchAlreadyFinalized) {
            setMessage(dispatchFinalizeGuardMessage(state.dispatchLineage) ?? "Already finalized");
            break;
          }
          if (!finalizationBundle?.service) throw new Error("Finalization service unavailable");
          const input = {
            ...state.finalizationInput,
            gateReference: state.finalizationInput.gateReference?.trim() || refs.gateScanRef,
            completionReference:
              state.finalizationInput.completionReference?.trim() || refs.gateScanRef,
            transporterReference:
              state.finalizationInput.transporterReference?.trim() || refs.transporterRef,
          };
          await finalizationBundle.service.finalizeDispatch(input, {
            ...ctxBase,
            actorRole: role ?? "DISPATCH_HEAD",
            finalizeReason: refs.overrideReason,
          });
          break;
        }
        case "4f_reservation": {
          const lines = await loadOrderLinesForReservation(supabase, state.orderId);
          const line = lines[0];
          if (!line) throw new Error("No order lines available for reservation");
          await createAndReserveInventoryForOrder(
            supabase,
            {
              orderId: state.orderId,
              productId: line.productId,
              sku: line.sku,
              quantity: line.quantity,
              locationCode: "WH-MAIN",
              sourceDepartment: "golden_chain_operator",
            },
            {
              correlationId: ctxBase.correlationId,
              actorUserId: ctxBase.actorUserId,
              actorRole: ctxBase.actorRole,
              actorDepartment: "golden_chain_operator",
            },
          );
          break;
        }
        case "4g_stock": {
          if (!stockBundle?.service || !state.stockInput) throw new Error("Stock service unavailable");
          const reservation = state.stockInput.reservations[0];
          if (!reservation || !state.stockInput.scanReference) {
            throw new Error("Missing reservation or scan reference");
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
            state.stockInput,
            {
              orderId: state.orderId,
              scanReference: state.stockInput.scanReference,
              gateReference: state.stockInput.gateReference,
              dispatchLineageId: state.stockInput.dispatchLineageId,
              items: [
                {
                  reservationId: reservation.id,
                  productId: reservation.productId,
                  sku: reservation.sku,
                  locationCode: state.stockInput.locationCode,
                  consumeQty: reservation.reservedQty || reservation.fulfilledQty,
                  expectedBalanceVersion,
                },
              ],
            },
            {
              correlationId: ctxBase.correlationId,
              actorUserId: ctxBase.actorUserId,
              actorRole: ctxBase.actorRole,
              finalizeReason: refs.overrideReason,
              overrideReason: role === "SUPER_ADMIN" ? refs.overrideReason : null,
            },
          );
          break;
        }
        default:
          break;
      }
      setMessage(`Success: ${state.cta}`);
      await reloadOrder(state.orderId);
      await reloadList();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const finalizeGuardMsg = state?.dispatchAlreadyFinalized
    ? dispatchFinalizeGuardMessage(state.dispatchLineage)
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Workflow className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Golden chain operator</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Phase 24 — single next action
        </Badge>
      </header>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 text-sm">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            One governed step at a time across 4B→4G. No payment, invoice, or customer notification on this surface.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Order selector</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search SO number or order id (min 2 chars)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="font-mono text-sm"
            />
            <Button type="button" size="icon" variant="outline" onClick={() => void reloadList()} disabled={loadingList}>
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-border p-1">
            {summaries.length === 0 && !loadingList && (
              <p className="p-2 text-xs text-muted-foreground">No matching pipeline orders.</p>
            )}
            {summaries.map((row) => (
              <button
                key={row.orderId}
                type="button"
                className={`flex w-full flex-col gap-0.5 rounded px-2 py-2 text-left text-xs hover:bg-muted ${
                  selectedId === row.orderId ? "bg-muted ring-1 ring-primary/40" : ""
                }`}
                onClick={() => setSelectedId(row.orderId)}
              >
                <span className="font-mono font-medium">
                  {row.orderNumber ?? `…${row.orderId.slice(-4)}`}
                </span>
                <span className="text-muted-foreground">
                  {row.orderStatus} · pay {row.paymentStatus ?? "—"} · {row.governanceStageLabel} ·{" "}
                  {row.nextAction}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loadingOrder && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading order chain…
        </p>
      )}

      {state && !loadingOrder && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {formatSalesOrderLabel({ id: state.orderId, order_number: state.orderNumber })}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Status · </span>
                {state.orderStatus}
              </p>
              <p>
                <span className="text-muted-foreground">Payment · </span>
                {state.paymentStatus ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Governance stage · </span>
                {governanceStageLabel(state.stage)}
              </p>
              <p>
                <span className="text-muted-foreground">Next action · </span>
                {state.cta}
              </p>
            </CardContent>
          </Card>

          <GovernancePrerequisiteList
            title="Blockers"
            items={state.blockers.map((b) => `${b.message} → ${b.action} (${b.route})`)}
            variant={state.blockers.length > 0 ? "destructive" : "default"}
          />

          {finalizeGuardMsg && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{finalizeGuardMsg}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={primaryDisabled} onClick={() => void runPrimaryAction()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {state.cta}
            </Button>
            {state.stage === "4e_dispatch_finalization" && state.dispatchAlreadyFinalized && (
              <Badge variant="secondary">Already finalized</Badge>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Auto evidence references</CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-[11px] space-y-1">
              <p>packing: {state.evidenceRefs.packingPhotoRef}</p>
              <p>document: {state.evidenceRefs.documentPlaceholderRef}</p>
              <p>gate: {state.evidenceRefs.gateScanRef}</p>
              <p>transporter: {state.evidenceRefs.transporterRef}</p>
            </CardContent>
          </Card>
        </>
      )}

      {message && <p className="text-sm">{message}</p>}

      <p className="text-xs text-muted-foreground">
        Detailed boards:{" "}
        <Link to="/admin/dispatch-readiness" className="underline">
          4B
        </Link>
        {" · "}
        <Link to="/admin/finance-governance" className="underline">
          4C
        </Link>
        {" · "}
        <Link to="/admin/dispatch-completion" className="underline">
          4D
        </Link>
        {" · "}
        <Link to="/admin/dispatch-finalization" className="underline">
          4E
        </Link>
        {" · "}
        <Link to="/admin/reservation-board" className="underline">
          4F
        </Link>
        {" · "}
        <Link to="/admin/stock-finalization" className="underline">
          4G
        </Link>
      </p>
    </div>
  );
}
