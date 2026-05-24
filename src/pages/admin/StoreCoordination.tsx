import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Heart,
  RefreshCw,
  Truck,
  Warehouse,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OperationalTimeline, type OperationalTimelineFilter } from "@/components/admin/OperationalTimeline";
import { supabase } from "@/integrations/supabase/client";
import {
  buildInventoryVisibilitySummary,
  deriveStoreStockConfidence,
  groupReadyGoodsByStore,
  matchOutletDisplayName,
  normalizeReadyGoodsRows,
  type ReadyGoodsVisibilityRow,
  type StoreStockConfidence,
} from "@/lib/inventory/readyGoodsVisibility";
import { buildInventoryOperationalFeed } from "@/lib/operational-events/inventoryFeed";
import { mergeOperationalEventFeeds } from "@/lib/operational-events/normalize";
import {
  buildRetailLaunchOperationalFeed,
  filterRetailLaunchTimelineEvents,
} from "@/lib/operational-events/retailLaunchFeed";
import {
  buildStoreCoordinationOperationalFeed,
  DEFAULT_RETAIL_OUTLETS,
  normalizeStoreCoordinationEvents,
} from "@/lib/operational-events/storeFeed";
import {
  buildCustomerPickupLabelPayload,
  buildFactoryFollowupLabelPayload,
  buildReservationLabelPayload,
} from "@/lib/barcode/barcodePayloads";

function StatusChip({ tone, children }: { tone: "info" | "warning" | "urgent" | "critical"; children: React.ReactNode }) {
  const map = {
    info: "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    urgent: "border-orange-500/50 bg-orange-500/10 text-orange-950 dark:text-orange-100",
    critical: "border-destructive/50 bg-destructive/10 text-destructive",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", map[tone])}>
      {children}
    </span>
  );
}

const INTEGRATION_MSG = "Retail integration pending — read-only projections will appear here once connected.";

const UNLINKED_OUTLET_LABEL = "Factory snapshot · outlet not linked";

function mkLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export type LocalReservationStatus = "draft_only" | "pending_backend" | "manual_verification_required";

export interface LocalReservationRow {
  id: string;
  customerName: string;
  phone: string;
  storeName: string;
  product: string;
  qtyDisplay: string;
  pickupDisplay: string | null;
  notes: string;
  status: LocalReservationStatus;
}

export interface LocalFactoryFollowupRow {
  id: string;
  storeName: string;
  product: string;
  qtyDisplay: string;
  neededByDisplay: string;
  department: string;
  urgency: string;
  linkedOrderId: string | null;
  whatsappHint: string | null;
  status: "pending_backend";
}

function confidenceChipTone(c: StoreStockConfidence): "info" | "warning" | "urgent" | "critical" {
  if (c === "verified_numeric") return "info";
  if (c === "partial") return "warning";
  if (c === "manual_verification_required") return "urgent";
  return "warning";
}

function confidenceLabel(c: StoreStockConfidence): string {
  if (c === "verified_numeric") return "Limited numeric";
  if (c === "partial") return "Partial";
  if (c === "manual_verification_required") return "Manual verify";
  return "Unknown";
}

/**
 * Store coordination — B1 shell + B2 visibility cards + B5 operational projections (read-only, no writes).
 */
export default function StoreCoordination() {
  const [tick, setTick] = useState(0);
  const refreshTimerRef = useRef<number | undefined>(undefined);
  const [timelineFilter, setTimelineFilter] = useState<OperationalTimelineFilter>("all");
  const [invRows, setInvRows] = useState<ReadyGoodsVisibilityRow[]>([]);
  const [invError, setInvError] = useState<string | null>(null);
  const [invLoading, setInvLoading] = useState(true);

  const [reservationDrafts, setReservationDrafts] = useState<LocalReservationRow[]>([]);
  const [resForm, setResForm] = useState({
    customerName: "",
    phone: "",
    storeId: DEFAULT_RETAIL_OUTLETS[0]?.id ?? "",
    product: "",
    qty: "",
    pickupLocal: "",
    notes: "",
  });

  const [factoryDrafts, setFactoryDrafts] = useState<LocalFactoryFollowupRow[]>([]);
  const [factoryForm, setFactoryForm] = useState({
    storeId: DEFAULT_RETAIL_OUTLETS[0]?.id ?? "",
    product: "",
    qty: "",
    neededByLocal: "",
    department: "",
    urgency: "normal",
    linkedOrderId: "",
    whatsappHint: "",
  });

  const [labelPreviewLog, setLabelPreviewLog] = useState<{ id: string; labelKind: string; context: string }[]>([]);
  const [previewJson, setPreviewJson] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  const outletNames = useMemo(() => DEFAULT_RETAIL_OUTLETS.map((o) => o.name), []);

  const fetchFactoryInventorySnapshot = useCallback(async () => {
    setInvLoading(true);
    const { data, error } = await supabase
      .from("factory_inventory")
      .select("quantity, last_updated, product_id, product:products ( id, name, sku, default_store )");
    setInvLoading(false);
    if (error) {
      setInvError(error.message);
      setInvRows([]);
      return;
    }
    const raw = (data ?? []) as Array<{
      quantity: number | null;
      last_updated: string | null;
      product_id: string | null;
      product: { id: string; name: string; sku: string | null; default_store: string | null } | null;
    }>;
    const mapped = raw
      .filter((r) => r.product?.id)
      .map((r) => {
        const p = r.product!;
        const matched = matchOutletDisplayName(p.default_store, outletNames);
        const outletLabel = matched ?? UNLINKED_OUTLET_LABEL;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          outletLabel,
          quantity: r.quantity,
          source: "factory_inventory" as const,
          lastUpdatedAt: r.last_updated,
        };
      });
    setInvRows(normalizeReadyGoodsRows(mapped));
    setInvError(null);
  }, [outletNames]);

  useEffect(() => {
    void fetchFactoryInventorySnapshot();
  }, [fetchFactoryInventorySnapshot]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const outletSummariesList = useMemo(
    () => DEFAULT_RETAIL_OUTLETS.map((o) => ({ outletId: o.id, outletName: o.name })),
    [],
  );

  const groupedByOutletLabel = useMemo(() => groupReadyGoodsByStore(invRows), [invRows]);

  const outletIdToSummary = useMemo(
    () => deriveStoreStockConfidence(outletSummariesList, groupedByOutletLabel),
    [groupedByOutletLabel, outletSummariesList],
  );

  const visibilitySummary = useMemo(
    () => buildInventoryVisibilitySummary(invRows, outletSummariesList, groupedByOutletLabel),
    [groupedByOutletLabel, invRows, outletSummariesList],
  );

  const canonicalOutletNames = useMemo(() => new Set(DEFAULT_RETAIL_OUTLETS.map((o) => o.name)), []);

  const unlinkedSkuRowCount = useMemo(
    () => invRows.filter((r) => !canonicalOutletNames.has(r.outletLabel)).length,
    [canonicalOutletNames, invRows],
  );

  const inventoryFeedEvents = useMemo(
    () =>
      buildInventoryOperationalFeed({
        rows: invRows,
        outletSummaries: [...outletIdToSummary.values()],
        fetchError: invError,
        declaredSource: "factory_inventory",
        nowMs: 0,
      }),
    [invError, invRows, outletIdToSummary],
  );

  const retailLaunchEvents = useMemo(
    () =>
      buildRetailLaunchOperationalFeed({
        reservations: reservationDrafts.map((r) => ({
          id: r.id,
          customerName: r.customerName,
          phone: r.phone,
          storeName: r.storeName,
          productLabel: r.product,
          qtyDisplay: r.qtyDisplay,
          pickupDisplay: r.pickupDisplay,
          notes: r.notes,
          status: r.status,
        })),
        factoryFollowups: factoryDrafts.map((f) => ({
          id: f.id,
          storeName: f.storeName,
          productLabel: f.product,
          qtyDisplay: f.qtyDisplay,
          neededByDisplay: f.neededByDisplay,
          department: f.department,
          urgency: f.urgency,
          linkedOrderId: f.linkedOrderId,
          whatsappHint: f.whatsappHint,
          status: f.status,
        })),
        labelPreviews: labelPreviewLog,
        nowMs: Date.now(),
      }),
    [reservationDrafts, factoryDrafts, labelPreviewLog, tick],
  );

  const reservationTimelineEvents = useMemo(
    () => filterRetailLaunchTimelineEvents(retailLaunchEvents, "reservation"),
    [retailLaunchEvents],
  );
  const pickupTimelineEvents = useMemo(() => filterRetailLaunchTimelineEvents(retailLaunchEvents, "pickup"), [retailLaunchEvents]);
  const factoryTimelineEvents = useMemo(() => filterRetailLaunchTimelineEvents(retailLaunchEvents, "factory"), [retailLaunchEvents]);
  const labelTimelineEvents = useMemo(() => filterRetailLaunchTimelineEvents(retailLaunchEvents, "label"), [retailLaunchEvents]);

  const suppressOutletStockUnknown = invRows.length > 0 && invError == null;

  const hasLocalReservationDrafts = reservationDrafts.length > 0;
  const hasLocalFactoryDrafts = factoryDrafts.length > 0;

  const timelineEvents = useMemo(() => {
    void tick;
    return normalizeStoreCoordinationEvents(
      mergeOperationalEventFeeds([
        buildStoreCoordinationOperationalFeed({
          outlets: DEFAULT_RETAIL_OUTLETS,
          reservations: [],
          followups: [],
          nowMs: 0,
          suppressPlaceholderOutletStockUnknown: suppressOutletStockUnknown,
          suppressReservationBackendPending: hasLocalReservationDrafts,
          suppressPickupFeedPending: hasLocalReservationDrafts,
          suppressFactoryFollowupPending: hasLocalFactoryDrafts,
        }),
        inventoryFeedEvents,
        retailLaunchEvents,
      ]),
    );
  }, [
    tick,
    suppressOutletStockUnknown,
    inventoryFeedEvents,
    retailLaunchEvents,
    hasLocalReservationDrafts,
    hasLocalFactoryDrafts,
  ]);

  const appendLabelPreview = useCallback((labelKind: string, context: string) => {
    setLabelPreviewLog((prev) =>
      [{ id: mkLocalId("lbl"), labelKind, context }, ...prev].slice(0, 40),
    );
    setTick((t) => t + 1);
  }, []);

  const saveReservationDraftLocal = useCallback(() => {
    const outlet = DEFAULT_RETAIL_OUTLETS.find((o) => o.id === resForm.storeId);
    const row: LocalReservationRow = {
      id: mkLocalId("res"),
      customerName: resForm.customerName.trim() || "—",
      phone: resForm.phone.trim() || "—",
      storeName: outlet?.name ?? "—",
      product: resForm.product.trim() || "—",
      qtyDisplay: resForm.qty.trim() || "—",
      pickupDisplay: resForm.pickupLocal.trim() || null,
      notes: resForm.notes.trim(),
      status: "draft_only",
    };
    setReservationDrafts((d) => [row, ...d]);
  }, [resForm]);

  const saveFactoryDraftLocal = useCallback(() => {
    const outlet = DEFAULT_RETAIL_OUTLETS.find((o) => o.id === factoryForm.storeId);
    const row: LocalFactoryFollowupRow = {
      id: mkLocalId("ff"),
      storeName: outlet?.name ?? "—",
      product: factoryForm.product.trim() || "—",
      qtyDisplay: factoryForm.qty.trim() || "—",
      neededByDisplay: factoryForm.neededByLocal.trim() || "—",
      department: factoryForm.department.trim() || "—",
      urgency: factoryForm.urgency,
      linkedOrderId: factoryForm.linkedOrderId.trim() || null,
      whatsappHint: factoryForm.whatsappHint.trim() || null,
      status: "pending_backend",
    };
    setFactoryDrafts((d) => [row, ...d]);
  }, [factoryForm]);

  const refresh = useCallback(() => {
    void fetchFactoryInventorySnapshot();
    if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      setTick((t) => t + 1);
      refreshTimerRef.current = undefined;
    }, 200);
  }, [fetchFactoryInventorySnapshot]);

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 pb-28">
      <header className="space-y-3 border-b border-border/80 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Retail operations</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Store coordination</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Mobile-first visibility across outlets, reservations, and factory follow-up. Human-controlled; no stock
              mutations from this surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip tone="info">Visibility</StatusChip>
            <StatusChip tone="warning">Operator</StatusChip>
            <StatusChip tone="critical">No writes</StatusChip>
          </div>
        </div>
      </header>

      {/* Ready goods visibility — read-only factory_inventory snapshot (not per-outlet shelf stock) */}
      <section className="space-y-3" aria-labelledby="ready-goods-visibility-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="ready-goods-visibility-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
            Ready goods visibility
          </h2>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px] uppercase">
              Source · factory_inventory (read-only)
            </Badge>
            {invLoading ? (
              <Badge variant="secondary" className="text-[10px] uppercase">
                Loading snapshot…
              </Badge>
            ) : invError ? (
              <Badge variant="destructive" className="text-[10px] uppercase">
                Read failed
              </Badge>
            ) : invRows.length === 0 ? (
              <Badge variant="secondary" className="text-[10px] uppercase">
                Integration pending
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] uppercase text-amber-900 dark:text-amber-100">
                Limited visibility — not shelf stock
              </Badge>
            )}
          </div>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {invError ? (
            <>
              <span className="font-medium text-destructive">Inventory read failed.</span> {invError} Outlet cards fall
              back to manual verification until the query succeeds.
            </>
          ) : invLoading ? (
            <>Loading the latest read-only snapshot from Supabase…</>
          ) : invRows.length === 0 ? (
            <>
              No <span className="font-mono text-foreground/90">factory_inventory</span> rows returned for this
              snapshot (or no linked products). Per-outlet shelf quantities are still{" "}
              <span className="font-medium text-amber-900 dark:text-amber-100">unknown</span> — treat as{" "}
              <span className="font-medium text-foreground">manual verification required</span>.
            </>
          ) : (
            <>
              Showing a <span className="font-medium text-foreground">factory-row</span> join to{" "}
              <span className="font-mono text-foreground/90">products.default_store</span> for outlet grouping only.
              This is <span className="font-medium text-foreground">not</span> branch shelf truth; unknown quantities
              stay unknown (nulls are never coerced to zero).
            </>
          )}
        </p>
        {!invLoading && invRows.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Summary:</span> rows {visibilitySummary.totalRows} · known qty{" "}
            {visibilitySummary.knownQtyRows} · unknown qty {visibilitySummary.unknownQtyRows} · outlets with matched rows{" "}
            {visibilitySummary.outletsWithData}
            {unlinkedSkuRowCount > 0 ? (
              <>
                {" "}
                · <span className="font-medium text-amber-900 dark:text-amber-100">{unlinkedSkuRowCount}</span> SKU row
                {unlinkedSkuRowCount === 1 ? "" : "s"} not linked to a listed outlet via{" "}
                <span className="font-mono">default_store</span>
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      {/* B2 — Stock visibility (outlet cards from adapter) */}
      <section className="space-y-3" aria-labelledby="store-stock-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="store-stock-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
            Outlet snapshot · stock confidence
          </h2>
          <Badge variant="outline" className="text-[10px] uppercase">
            {invLoading
              ? "Loading…"
              : invError
                ? "Read error — verify manually"
                : invRows.length === 0
                  ? "No live shelf quantities"
                  : "Factory rows only"}
          </Badge>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Cards use <span className="font-medium text-foreground">deriveStoreStockConfidence</span> over grouped{" "}
          <span className="font-mono">factory_inventory</span> rows. Empty or failed reads keep{" "}
          <span className="font-medium text-amber-900 dark:text-amber-100">integration pending / manual verification</span>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_RETAIL_OUTLETS.map((o) => {
            const s = outletIdToSummary.get(o.id);
            const conf: StoreStockConfidence = s?.confidence ?? "unknown";
            const tone = confidenceChipTone(conf);
            const showNumericHint = s && s.rowCount > 0 && s.knownQtyCount > 0;
            return (
              <Card
                key={o.id}
                className={cn(
                  "overflow-hidden rounded-md shadow-none ring-1 ring-border/50",
                  conf === "unknown" || invError || (invRows.length === 0 && !invLoading)
                    ? "border-amber-500/25 bg-gradient-to-br from-card to-amber-500/5"
                    : "border-sky-500/20 bg-gradient-to-br from-card to-sky-500/5",
                )}
              >
                <CardHeader className="space-y-1 border-b border-border/60 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight">{o.name}</CardTitle>
                    <StatusChip tone={tone}>{confidenceLabel(conf)}</StatusChip>
                  </div>
                  <CardDescription className="text-[11px]">Outlet ID · {o.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 px-4 py-3 text-[11px] leading-snug text-muted-foreground">
                  {invError ? (
                    <p>
                      <span className="font-medium text-foreground">Stock confidence:</span> Read unavailable — manual
                      verification required.
                    </p>
                  ) : invRows.length === 0 && !invLoading ? (
                    <p>
                      <span className="font-medium text-foreground">Stock confidence:</span> Integration pending — manual
                      verification required.
                    </p>
                  ) : s && s.rowCount === 0 ? (
                    <p>
                      <span className="font-medium text-foreground">Stock confidence:</span> No SKUs linked to this outlet
                      via <span className="font-mono">products.default_store</span> — manual verification required.
                    </p>
                  ) : s && conf === "manual_verification_required" ? (
                    <p>
                      <span className="font-medium text-foreground">Stock confidence:</span> Rows present but all
                      quantities are null/unknown in source — manual verification required.
                    </p>
                  ) : s && conf === "partial" ? (
                    <p>
                      <span className="font-medium text-foreground">Stock confidence:</span> Partial — known qty rows{" "}
                      {s.knownQtyCount}, unknown {s.unknownQtyCount} (factory snapshot; not shelf-level).
                    </p>
                  ) : s && conf === "verified_numeric" ? (
                    <p>
                      <span className="font-medium text-foreground">Stock confidence:</span> All matched rows report a
                      numeric factory quantity (informational only; confirm before customer promise).
                    </p>
                  ) : (
                    <p>
                      <span className="font-medium text-foreground">Stock confidence:</span> Unknown — manual verification
                      required.
                    </p>
                  )}
                  {showNumericHint && s ? (
                    <p>
                      <span className="font-medium text-foreground">Factory row signal:</span> {s.rowCount} row
                      {s.rowCount === 1 ? "" : "s"} · max known qty {s.maxKnownQty ?? "—"} (not shelf stock).
                    </p>
                  ) : null}
                  <p>
                    <span className="font-medium text-foreground">Operational risk:</span> Customer may see packing as
                    unavailable; reservations cannot be guaranteed from this screen.
                  </p>
                  <p className="rounded border border-border/80 bg-muted/30 px-2 py-1.5 text-foreground">
                    <span className="font-medium">Safe action:</span> Verify with store / factory directly; use factory
                    follow-up queue once backend is connected.
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* B2 — Reservation control shell (local drafts only — no DB write) */}
      <section className="space-y-3" aria-labelledby="res-queue-heading">
        <h2 id="res-queue-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
          Reservation / prebooking control
        </h2>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] leading-snug text-destructive" role="alert">
          <strong className="font-semibold">Reservation is not guaranteed until stock is manually verified.</strong> No
          stock deduction. Backend persistence is not wired — drafts stay on this device only.
        </div>
        <Card className="border-border/80 shadow-none">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">New reservation (draft)</CardTitle>
            <CardDescription className="text-[11px]">Capture intent locally; submit to server stays disabled.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="res-customer">Customer name</Label>
              <Input
                id="res-customer"
                value={resForm.customerName}
                onChange={(e) => setResForm((f) => ({ ...f, customerName: e.target.value }))}
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-phone">Phone</Label>
              <Input
                id="res-phone"
                value={resForm.phone}
                onChange={(e) => setResForm((f) => ({ ...f, phone: e.target.value }))}
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={resForm.storeId} onValueChange={(v) => setResForm((f) => ({ ...f, storeId: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_RETAIL_OUTLETS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-product">Product / packing</Label>
              <Input
                id="res-product"
                value={resForm.product}
                onChange={(e) => setResForm((f) => ({ ...f, product: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-qty">Qty (display text)</Label>
              <Input
                id="res-qty"
                value={resForm.qty}
                onChange={(e) => setResForm((f) => ({ ...f, qty: e.target.value }))}
                placeholder="e.g. 2 trays"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-pickup">Pickup date / time</Label>
              <Input
                id="res-pickup"
                type="datetime-local"
                value={resForm.pickupLocal}
                onChange={(e) => setResForm((f) => ({ ...f, pickupLocal: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="res-notes">Notes</Label>
              <Textarea
                id="res-notes"
                rows={2}
                value={resForm.notes}
                onChange={(e) => setResForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="button" variant="default" onClick={saveReservationDraftLocal}>
                Save draft (local only)
              </Button>
              <Button type="button" variant="secondary" disabled title="Backend table not enabled for writes from this screen">
                Submit to backend (pending)
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="hidden overflow-x-auto rounded-md border border-border md:block">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Pickup</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Labels</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {reservationDrafts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                    No local drafts yet.
                  </td>
                </tr>
              ) : (
                reservationDrafts.map((r) => (
                  <tr key={r.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{r.customerName}</td>
                    <td className="px-3 py-2 font-mono">{r.phone}</td>
                    <td className="px-3 py-2">{r.storeName}</td>
                    <td className="px-3 py-2">{r.product}</td>
                    <td className="px-3 py-2 font-mono">{r.qtyDisplay}</td>
                    <td className="px-3 py-2 font-mono">{r.pickupDisplay ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {r.status === "draft_only"
                          ? "Draft only"
                          : r.status === "pending_backend"
                            ? "Pending backend"
                            : "Manual verification required"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => {
                            const p = buildReservationLabelPayload({
                              reservationId: r.id,
                              customerName: r.customerName,
                              storeName: r.storeName,
                              productLabel: r.product,
                              qtyDisplay: r.qtyDisplay,
                              pickupDisplay: r.pickupDisplay ?? "",
                            });
                            setPreviewTitle("Reservation label payload");
                            setPreviewJson(JSON.stringify(p, null, 2));
                            appendLabelPreview("reservation", r.id);
                          }}
                        >
                          Reservation label
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => {
                            const p = buildCustomerPickupLabelPayload({
                              pickupRef: r.id,
                              storeName: r.storeName,
                              customerName: r.customerName,
                              pickupWindow: r.pickupDisplay ?? "",
                            });
                            setPreviewTitle("Customer pickup label payload");
                            setPreviewJson(JSON.stringify(p, null, 2));
                            appendLabelPreview("customer_pickup", r.id);
                          }}
                        >
                          Pickup label
                        </Button>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-muted-foreground">{r.notes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">
          {reservationDrafts.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">No local drafts yet.</p>
          ) : (
            reservationDrafts.map((r) => (
              <Card key={r.id} className="rounded-md border-border/80 shadow-none">
                <CardContent className="space-y-2 p-3 text-xs">
                  <p className="font-semibold text-foreground">{r.storeName}</p>
                  <p className="text-muted-foreground">
                    {r.customerName} · {r.phone}
                  </p>
                  <p className="text-muted-foreground">
                    {r.product} · Qty {r.qtyDisplay} · Pickup {r.pickupDisplay ?? "—"}
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {r.status === "draft_only" ? "Draft only" : r.status === "pending_backend" ? "Pending backend" : "Manual verification required"}
                  </Badge>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px]"
                      onClick={() => {
                        const p = buildReservationLabelPayload({
                          reservationId: r.id,
                          customerName: r.customerName,
                          storeName: r.storeName,
                          productLabel: r.product,
                          qtyDisplay: r.qtyDisplay,
                          pickupDisplay: r.pickupDisplay ?? "",
                        });
                        setPreviewTitle("Reservation label payload");
                        setPreviewJson(JSON.stringify(p, null, 2));
                        appendLabelPreview("reservation", r.id);
                      }}
                    >
                      Reservation label
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px]"
                      onClick={() => {
                        const p = buildCustomerPickupLabelPayload({
                          pickupRef: r.id,
                          storeName: r.storeName,
                          customerName: r.customerName,
                          pickupWindow: r.pickupDisplay ?? "",
                        });
                        setPreviewTitle("Customer pickup label payload");
                        setPreviewJson(JSON.stringify(p, null, 2));
                        appendLabelPreview("customer_pickup", r.id);
                      }}
                    >
                      Pickup label
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* B2 — Factory follow-up workflow shell (local drafts — no writes) */}
      <section className="space-y-3" aria-labelledby="factory-queue-heading">
        <h2 id="factory-queue-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
          Factory follow-up workflow
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Draft rows stay local until a backend queue exists. Actions below are intentionally disabled or preview-only.
        </p>
        <Card className="border-border/80 shadow-none">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">New factory follow-up (draft)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={factoryForm.storeId} onValueChange={(v) => setFactoryForm((f) => ({ ...f, storeId: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_RETAIL_OUTLETS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ff-product">Product</Label>
              <Input
                id="ff-product"
                value={factoryForm.product}
                onChange={(e) => setFactoryForm((f) => ({ ...f, product: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ff-qty">Qty (display text)</Label>
              <Input
                id="ff-qty"
                value={factoryForm.qty}
                onChange={(e) => setFactoryForm((f) => ({ ...f, qty: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ff-needed">Needed by</Label>
              <Input
                id="ff-needed"
                type="date"
                value={factoryForm.neededByLocal}
                onChange={(e) => setFactoryForm((f) => ({ ...f, neededByLocal: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ff-dept">Department</Label>
              <Input
                id="ff-dept"
                value={factoryForm.department}
                onChange={(e) => setFactoryForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Assembly"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <Select value={factoryForm.urgency} onValueChange={(v) => setFactoryForm((f) => ({ ...f, urgency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ff-order">Linked order (optional)</Label>
              <Input
                id="ff-order"
                value={factoryForm.linkedOrderId}
                onChange={(e) => setFactoryForm((f) => ({ ...f, linkedOrderId: e.target.value }))}
                placeholder="Order id if known"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ff-wa">WhatsApp hint (optional)</Label>
              <Input
                id="ff-wa"
                value={factoryForm.whatsappHint}
                onChange={(e) => setFactoryForm((f) => ({ ...f, whatsappHint: e.target.value }))}
                placeholder="Thread ref or phone — not sent automatically"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="button" variant="default" onClick={saveFactoryDraftLocal}>
                Save draft (local only)
              </Button>
              <Button type="button" variant="secondary" disabled title="No backend follow-up queue yet">
                Create follow-up — backend pending
              </Button>
              <Button type="button" variant="secondary" disabled title="No outbound automation from this screen">
                Notify factory — disabled
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="hidden overflow-x-auto rounded-md border border-border md:block">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Needed by</th>
                <th className="px-3 py-2">Dept</th>
                <th className="px-3 py-2">Urgency</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">WA hint</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Label</th>
              </tr>
            </thead>
            <tbody>
              {factoryDrafts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-muted-foreground">
                    No local follow-up drafts yet.
                  </td>
                </tr>
              ) : (
                factoryDrafts.map((r) => (
                  <tr key={r.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2">{r.storeName}</td>
                    <td className="px-3 py-2">{r.product}</td>
                    <td className="px-3 py-2 font-mono">{r.qtyDisplay}</td>
                    <td className="px-3 py-2 font-mono">{r.neededByDisplay}</td>
                    <td className="px-3 py-2">{r.department}</td>
                    <td className="px-3 py-2">{r.urgency}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.linkedOrderId ?? "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground">{r.whatsappHint ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        Pending backend
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => {
                          const p = buildFactoryFollowupLabelPayload({
                            followupId: r.id,
                            department: r.department,
                            urgency: r.urgency,
                            neededByDisplay: r.neededByDisplay,
                            productLabel: r.product,
                            storeName: r.storeName,
                          });
                          setPreviewTitle("Factory follow-up label payload");
                          setPreviewJson(JSON.stringify(p, null, 2));
                          appendLabelPreview("factory_followup_internal", r.id);
                        }}
                      >
                        Preview label
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">
          {factoryDrafts.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">No local follow-up drafts yet.</p>
          ) : (
            factoryDrafts.map((r) => (
              <Card key={r.id} className="rounded-md border-border/80 shadow-none">
                <CardContent className="space-y-2 p-3 text-xs">
                  <p className="font-semibold text-foreground">{r.storeName}</p>
                  <p className="text-muted-foreground">{r.product}</p>
                  <p className="text-muted-foreground">
                    Qty {r.qtyDisplay} · By {r.neededByDisplay} · {r.department} · {r.urgency}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px]"
                    onClick={() => {
                      const p = buildFactoryFollowupLabelPayload({
                        followupId: r.id,
                        department: r.department,
                        urgency: r.urgency,
                        neededByDisplay: r.neededByDisplay,
                        productLabel: r.product,
                        storeName: r.storeName,
                      });
                      setPreviewTitle("Factory follow-up label payload");
                      setPreviewJson(JSON.stringify(p, null, 2));
                      appendLabelPreview("factory_followup_internal", r.id);
                    }}
                  >
                    Preview label
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Remaining roadmap slots */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Additional coordination lanes">
        {[
          { title: "Inter-store coordination", icon: Building2 },
          { title: "Retail alerts", icon: AlertTriangle },
          { title: "Wedding / bulk preparation", icon: Heart },
        ].map(({ title, icon: Icon }) => (
          <Card key={title} className="rounded-md border-border/80 shadow-none ring-1 ring-border/40">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b border-border/60 px-4 py-3">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4">
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">{INTEGRATION_MSG}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* B5 + B7 — Operational timelines (overview + retail launch lanes) */}
      <section className="space-y-4" aria-labelledby="store-timeline-heading">
        <h2 id="store-timeline-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
          Operational timelines
        </h2>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Overview merges store coordination, inventory visibility, and retail launch projections. Sub-lanes show only
          retail / label events. occurredAt stays empty for snapshot projections — no fabricated event timestamps.
        </p>
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Overview</h3>
          <OperationalTimeline
            events={timelineEvents}
            filter={timelineFilter}
            onFilterChange={setTimelineFilter}
            ariaLabel="Store coordination overview timeline"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Reservation timeline</h3>
            <OperationalTimeline
              events={reservationTimelineEvents}
              showFilters={false}
              defaultFilter="all"
              ariaLabel="Reservation projection timeline"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pickup timeline</h3>
            <OperationalTimeline
              events={pickupTimelineEvents}
              showFilters={false}
              defaultFilter="all"
              ariaLabel="Pickup projection timeline"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Factory follow-up timeline
            </h3>
            <OperationalTimeline
              events={factoryTimelineEvents}
              showFilters={false}
              defaultFilter="all"
              ariaLabel="Factory follow-up projection timeline"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Label preview timeline</h3>
            <OperationalTimeline
              events={labelTimelineEvents}
              showFilters={false}
              defaultFilter="all"
              ariaLabel="Label preview projection timeline"
            />
          </div>
        </div>
      </section>

      <Dialog
        open={previewJson != null}
        onOpenChange={(open) => {
          if (!open) setPreviewJson(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
            <DialogDescription>Payload preview only — no print job and no database write.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[min(360px,50vh)] overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[10px] leading-snug">
            {previewJson}
          </pre>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:left-64",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="default" className="min-h-9 min-w-[44px] touch-manipulation" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Refresh view
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="min-h-9 rounded-md px-3 py-1.5 text-[11px] font-medium">
              <Warehouse className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              {invError || invRows.length === 0
                ? "Inventory visibility pending"
                : "Factory inventory snapshot (read-only)"}
            </Badge>
            <Badge variant="secondary" className="min-h-9 rounded-md px-3 py-1.5 text-[11px] font-medium">
              Reservations offline
            </Badge>
            <Badge variant="secondary" className="min-h-9 rounded-md px-3 py-1.5 text-[11px] font-medium">
              <Truck className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Dispatch neutral
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
