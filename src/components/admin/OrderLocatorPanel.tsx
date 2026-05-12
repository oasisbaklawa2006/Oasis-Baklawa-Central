import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Route, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORDER_LOCATOR_RAW_STATUSES,
  buildOrderTracePreview,
  matchesLocatorDerivedBucket,
  type OrderLocatorDerivedBucket,
  type OrderTraceInputs,
  type OrderTracePreview,
} from "@/utils/orderTrace";
import { formatSalesOrderLabel } from "@/utils/orderSoLabel";

const ANY_VALUE = "__any__";
const DEBOUNCE_MS = 380;
const RESULT_CAP = 35;
const SCAN_CAP = 200;

/** Left join — orders without a company row still appear (non–client-tab searches). */
const ORDER_LOCATOR_SELECT = `
  id,
  order_number,
  status,
  payment_status,
  advance_paid,
  advance_required,
  sales_order_value,
  courier_name,
  tracking_number,
  eway_bill_number,
  admin_promised_date,
  created_at,
  company_id,
  company:companies(business_name, phone, gst_number)
`;

/** Inner join — client-tab filters on company fields must only return rows with a matching company embed. */
const ORDER_LOCATOR_SELECT_CLIENT = `
  id,
  order_number,
  status,
  payment_status,
  advance_paid,
  advance_required,
  sales_order_value,
  courier_name,
  tracking_number,
  eway_bill_number,
  admin_promised_date,
  created_at,
  company_id,
  company:companies!inner(business_name, phone, gst_number)
`;

interface LocatorCompany {
  business_name: string;
  phone: string | null;
  gst_number: string | null;
}

export interface LocatorOrderBase extends OrderTraceInputs {
  id: string;
  /** Persisted human-readable SO (SO-YYYY-NNNNNN); missing only before migration / anomaly. */
  order_number?: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  eway_bill_number: string | null;
  admin_promised_date: string | null;
  created_at: string | null;
  company_id: string | null;
  company: LocatorCompany | null;
}

interface LocatorResultRow {
  base: LocatorOrderBase;
  preview: OrderTracePreview;
}

interface OrderLocatorPanelProps {
  onOpenTrace: (orderId: string) => void;
}

function sanitizeIlike(q: string): string {
  return q.replace(/%/g, "").replace(/_/g, "").trim();
}

/**
 * Quote the right-hand side of a PostgREST filter atom inside a comma-separated `.or()` string.
 * Without this, user commas/parens/operators split or corrupt the expression.
 */
function quotePostgrestOrRhs(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function groupByOrderId<T extends { order_id: string | null }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const oid = r.order_id;
    if (!oid) continue;
    if (!m.has(oid)) m.set(oid, []);
    m.get(oid)!.push(r);
  }
  return m;
}

async function enrichOrders(bases: LocatorOrderBase[]): Promise<LocatorResultRow[]> {
  const ids = bases.map((o) => o.id);
  if (ids.length === 0) return [];

  const [itemsRes, jobsRes, reqsRes] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "order_id, quantity, actual_packed_qty, production_status, department, product:products(name, department, production_department)",
      )
      .in("order_id", ids),
    supabase.from("production_jobs").select("order_id, status, department").in("order_id", ids),
    supabase
      .from("store_requisitions")
      .select("order_id, status, store_requisition_items(requested_qty, fulfilled_qty)")
      .in("order_id", ids),
  ]);

  type ItemRow = {
    order_id: string | null;
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
  type JobRow = { order_id: string | null; status: string; department: string };
  type ReqRow = {
    order_id: string | null;
    status: string | null;
    store_requisition_items?: { requested_qty: number; fulfilled_qty: number | null }[];
  };

  const items = (itemsRes.data ?? []) as ItemRow[];
  const jobs = (jobsRes.data ?? []) as JobRow[];
  const reqs = (reqsRes.data ?? []) as ReqRow[];

  const itemsBy = groupByOrderId(items);
  const jobsBy = groupByOrderId(jobs);
  const reqsBy = groupByOrderId(reqs);

  return bases.map((base) => {
    const ji = (jobsBy.get(base.id) ?? []).map((j) => ({ status: j.status, department: j.department }));
    const preview = buildOrderTracePreview(base, itemsBy.get(base.id) ?? [], reqsBy.get(base.id) ?? [], ji);
    return { base, preview };
  });
}

/** Dedupe enriched locator rows by order id (first occurrence wins). */
function mergeLocatorResultRows(buckets: LocatorResultRow[][]): LocatorResultRow[] {
  const byId = new Map<string, LocatorResultRow>();
  for (const rows of buckets) {
    for (const r of rows) {
      if (!byId.has(r.base.id)) byId.set(r.base.id, r);
    }
  }
  return [...byId.values()];
}

export default function OrderLocatorPanel({ onOpenTrace }: OrderLocatorPanelProps) {
  const [tab, setTab] = useState("so");

  const [soQuery, setSoQuery] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [rawStatus, setRawStatus] = useState<string>(ANY_VALUE);
  const [derivedBucket, setDerivedBucket] = useState<string>(ANY_VALUE);
  const [deptChoice, setDeptChoice] = useState<string>(ANY_VALUE);
  const [productQuery, setProductQuery] = useState("");
  const [dispatchText, setDispatchText] = useState("");
  const [dispatchBucket, setDispatchBucket] = useState<string>(ANY_VALUE);

  const [exceptionDelayed, setExceptionDelayed] = useState(false);
  const [exceptionBalance, setExceptionBalance] = useState(false);
  const [exceptionAdvance, setExceptionAdvance] = useState(false);
  const [exceptionPartial, setExceptionPartial] = useState(false);
  const [exceptionReq, setExceptionReq] = useState(false);

  const [deptOptions, setDeptOptions] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LocatorResultRow[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("products")
      .select("production_department, department")
      .limit(800)
      .then(({ data }) => {
        const s = new Set<string>();
        for (const r of data ?? []) {
          const p = (r as { production_department?: string | null; department?: string | null }).production_department;
          const d = (r as { production_department?: string | null; department?: string | null }).department;
          if (p?.trim()) s.add(p.trim());
          if (d?.trim()) s.add(d.trim());
        }
        setDeptOptions([...s].sort((a, b) => a.localeCompare(b)));
      });
  }, []);

  const runSearch = useCallback(
    async (mode: string, signal?: { cancelled: boolean }) => {
      setLoading(true);
      setLastError(null);
      try {
        let bases: LocatorOrderBase[] = [];

        if (mode === "so") {
          const raw = sanitizeIlike(soQuery);
          const tail = raw.replace(/^SO-/i, "").trim();
          if (tail.length < 2) {
            setResults([]);
            setLoading(false);
            return;
          }
          const idCompact = tail.replace(/-/g, "");
          if (idCompact.length < 2) {
            setResults([]);
            setLoading(false);
            return;
          }
          const rhsHuman = quotePostgrestOrRhs(`%${tail}%`);
          const rhsUuid = quotePostgrestOrRhs(`%${idCompact}%`);
          const { data, error } = await supabase
            .from("orders")
            .select(ORDER_LOCATOR_SELECT)
            .neq("status", "draft")
            .or(`order_number.ilike.${rhsHuman},id.ilike.${rhsUuid}`)
            .order("created_at", { ascending: false })
            .limit(RESULT_CAP);
          if (error) throw error;
          bases = (data ?? []) as LocatorOrderBase[];
        } else if (mode === "client") {
          const q = sanitizeIlike(clientQuery);
          if (q.length < 2) {
            setResults([]);
            setLoading(false);
            return;
          }
          const pattern = `%${q}%`;
          const rhs = quotePostgrestOrRhs(pattern);
          const { data, error } = await supabase
            .from("orders")
            .select(ORDER_LOCATOR_SELECT_CLIENT)
            .neq("status", "draft")
            .or(`business_name.ilike.${rhs},phone.ilike.${rhs},gst_number.ilike.${rhs}`, {
              foreignTable: "companies",
            })
            .order("created_at", { ascending: false })
            .limit(RESULT_CAP);
          if (error) throw error;
          bases = (data ?? []) as LocatorOrderBase[];
        } else if (mode === "status") {
          if (rawStatus === ANY_VALUE && derivedBucket === ANY_VALUE) {
            setResults([]);
            setLoading(false);
            return;
          }

          let query = supabase
            .from("orders")
            .select(ORDER_LOCATOR_SELECT)
            .neq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(SCAN_CAP);

          if (rawStatus !== ANY_VALUE) {
            query = query.eq("status", rawStatus);
          }

          const { data, error } = await query;
          if (error) throw error;
          bases = (data ?? []) as LocatorOrderBase[];

          if (derivedBucket !== ANY_VALUE) {
            const enriched = await enrichOrders(bases);
            if (signal?.cancelled) return;
            const filtered = enriched.filter((row) =>
              matchesLocatorDerivedBucket(row.preview, derivedBucket as OrderLocatorDerivedBucket),
            );
            setResults(filtered.slice(0, RESULT_CAP));
            setLoading(false);
            return;
          }
        } else if (mode === "department") {
          if (deptChoice === ANY_VALUE) {
            setResults([]);
            setLoading(false);
            return;
          }
          const [{ data: pd, error: pe1 }, { data: dd, error: pe2 }] = await Promise.all([
            supabase.from("products").select("id").eq("production_department", deptChoice).limit(400),
            supabase.from("products").select("id").eq("department", deptChoice).limit(400),
          ]);
          if (pe1) throw pe1;
          if (pe2) throw pe2;
          const pids = [...new Set([...(pd ?? []), ...(dd ?? [])].map((p: { id: string }) => p.id))];
          if (pids.length === 0) {
            setResults([]);
            setLoading(false);
            return;
          }
          const { data: oi, error: oie } = await supabase
            .from("order_items")
            .select("order_id")
            .in("product_id", pids)
            .limit(500);
          if (oie) throw oie;
          const orderIds = [...new Set((oi ?? []).map((r: { order_id: string }) => r.order_id))].filter(Boolean).slice(0, RESULT_CAP);
          if (orderIds.length === 0) {
            setResults([]);
            setLoading(false);
            return;
          }
          const { data, error } = await supabase
            .from("orders")
            .select(ORDER_LOCATOR_SELECT)
            .in("id", orderIds)
            .neq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(RESULT_CAP);
          if (error) throw error;
          bases = (data ?? []) as LocatorOrderBase[];
        } else if (mode === "product") {
          const q = sanitizeIlike(productQuery);
          if (q.length < 2) {
            setResults([]);
            setLoading(false);
            return;
          }
          const pattern = `%${q}%`;
          const rhs = quotePostgrestOrRhs(pattern);
          const { data: prodRows, error: pe } = await supabase
            .from("products")
            .select("id")
            .or(`name.ilike.${rhs},sku.ilike.${rhs},category.ilike.${rhs}`)
            .limit(250);
          if (pe) throw pe;
          const pids = [...new Set((prodRows ?? []).map((p: { id: string }) => p.id))];
          if (pids.length === 0) {
            setResults([]);
            setLoading(false);
            return;
          }
          const { data: oi, error: oie } = await supabase
            .from("order_items")
            .select("order_id")
            .in("product_id", pids)
            .limit(600);
          if (oie) throw oie;
          const orderIds = [...new Set((oi ?? []).map((r: { order_id: string }) => r.order_id))].filter(Boolean).slice(0, RESULT_CAP);
          if (orderIds.length === 0) {
            setResults([]);
            setLoading(false);
            return;
          }
          const { data, error } = await supabase
            .from("orders")
            .select(ORDER_LOCATOR_SELECT)
            .in("id", orderIds)
            .neq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(RESULT_CAP);
          if (error) throw error;
          bases = (data ?? []) as LocatorOrderBase[];
        } else if (mode === "dispatch") {
          const t = sanitizeIlike(dispatchText);
          let query = supabase
            .from("orders")
            .select(ORDER_LOCATOR_SELECT)
            .neq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(SCAN_CAP);

          if (t.length >= 2) {
            const pattern = `%${t}%`;
            const rhs = quotePostgrestOrRhs(pattern);
            query = query.or(`tracking_number.ilike.${rhs},courier_name.ilike.${rhs},eway_bill_number.ilike.${rhs}`);
          }

          const { data, error } = await query;
          if (error) throw error;
          bases = (data ?? []) as LocatorOrderBase[];

          if (dispatchBucket !== ANY_VALUE) {
            const enriched = await enrichOrders(bases);
            if (signal?.cancelled) return;
            const filtered = enriched.filter((row) =>
              matchesLocatorDerivedBucket(row.preview, dispatchBucket as OrderLocatorDerivedBucket),
            );
            setResults(filtered.slice(0, RESULT_CAP));
            setLoading(false);
            return;
          }
          if (t.length >= 2) {
            const enriched = await enrichOrders(bases);
            if (signal?.cancelled) return;
            setResults(enriched.slice(0, RESULT_CAP));
            setLoading(false);
            return;
          }
          setResults([]);
          setLoading(false);
          return;
        } else if (mode === "exceptions") {
          const resultBuckets: LocatorResultRow[][] = [];

          if (exceptionDelayed) {
            const today = new Date().toISOString().slice(0, 10);
            const { data, error } = await supabase
              .from("orders")
              .select(ORDER_LOCATOR_SELECT)
              .neq("status", "draft")
              .not("status", "eq", "delivered")
              .not("status", "eq", "cancelled")
              .lt("admin_promised_date", `${today}T23:59:59`)
              .not("admin_promised_date", "is", null)
              .order("admin_promised_date", { ascending: true })
              .limit(RESULT_CAP);
            if (error) throw error;
            resultBuckets.push(await enrichOrders((data ?? []) as LocatorOrderBase[]));
          }

          const needsEnrichedScan =
            exceptionBalance || exceptionAdvance || exceptionPartial || exceptionReq;

          if (needsEnrichedScan) {
            const { data, error } = await supabase
              .from("orders")
              .select(ORDER_LOCATOR_SELECT)
              .neq("status", "draft")
              .order("created_at", { ascending: false })
              .limit(SCAN_CAP);
            if (error) throw error;
            const scan = (data ?? []) as LocatorOrderBase[];
            const enriched = await enrichOrders(scan);
            if (signal?.cancelled) return;
            const matchedRows = enriched.filter((row) => {
              if (exceptionAdvance && row.preview.finance.awaiting_advance) return true;
              if (exceptionBalance && row.preview.finance.balance_pending) return true;
              if (
                exceptionPartial &&
                (row.base.status === "partial_ready" || row.preview.dispatch === "partially_ready")
              ) {
                return true;
              }
              if (exceptionReq && row.preview.requisitionPendingUnits > 0) return true;
              return false;
            });
            resultBuckets.push(matchedRows);
          }

          if (resultBuckets.length === 0) {
            setResults([]);
            setLoading(false);
            return;
          }

          const merged = mergeLocatorResultRows(resultBuckets).slice(0, RESULT_CAP);
          if (signal?.cancelled) return;
          setResults(merged);
          setLoading(false);
          return;
        }

        if (signal?.cancelled) return;

        if (mode === "status" && derivedBucket === ANY_VALUE) {
          const enriched = await enrichOrders(bases.slice(0, RESULT_CAP));
          if (signal?.cancelled) return;
          setResults(enriched);
          setLoading(false);
          return;
        }

        if (
          mode === "so" ||
          mode === "client" ||
          mode === "department" ||
          mode === "product"
        ) {
          const enriched = await enrichOrders(bases.slice(0, RESULT_CAP));
          if (signal?.cancelled) return;
          setResults(enriched);
          setLoading(false);
          return;
        }

        setResults([]);
      } catch (e: unknown) {
        if (!signal?.cancelled) {
          const msg = e instanceof Error ? e.message : "Search failed";
          setLastError(msg);
          setResults([]);
        }
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [
      soQuery,
      clientQuery,
      rawStatus,
      derivedBucket,
      deptChoice,
      productQuery,
      dispatchText,
      dispatchBucket,
      exceptionDelayed,
      exceptionBalance,
      exceptionAdvance,
      exceptionPartial,
      exceptionReq,
    ],
  );

  useEffect(() => {
    const ctrl = { cancelled: false };

    const t = window.setTimeout(() => {
      void (async () => {
        if (tab === "so") await runSearch("so", ctrl);
        else if (tab === "client") await runSearch("client", ctrl);
        else if (tab === "product") await runSearch("product", ctrl);
      })();
    }, DEBOUNCE_MS);

    return () => {
      ctrl.cancelled = true;
      window.clearTimeout(t);
    };
  }, [tab, soQuery, clientQuery, productQuery, runSearch]);

  const derivedBucketOptions = useMemo(
    (): { value: OrderLocatorDerivedBucket; label: string }[] => [
      { value: "finance_awaiting_advance", label: "Finance · awaiting advance" },
      { value: "finance_advance_verified", label: "Finance · advance verified" },
      { value: "finance_balance_pending", label: "Finance · balance pending" },
      { value: "dispatch_not_ready", label: "Dispatch · not_ready" },
      { value: "dispatch_partially_ready", label: "Dispatch · partially_ready" },
      { value: "dispatch_packed_ready", label: "Dispatch · packed_ready" },
      { value: "dispatch_dispatched", label: "Dispatch · dispatched" },
    ],
    [],
  );

  const financeBadge = (preview: OrderTracePreview) => (
    <div className="flex flex-wrap gap-1">
      {preview.finance.awaiting_advance && (
        <Badge variant="outline" className="text-[10px] font-normal">
          awaiting_advance
        </Badge>
      )}
      {preview.finance.advance_verified && (
        <Badge variant="outline" className="text-[10px] font-normal">
          advance_verified
        </Badge>
      )}
      {preview.finance.balance_pending && (
        <Badge variant="outline" className="text-[10px] font-normal">
          balance_pending
        </Badge>
      )}
      {!preview.finance.awaiting_advance &&
        !preview.finance.advance_verified &&
        !preview.finance.balance_pending && (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Order locator</h2>
          <p className="text-xs text-muted-foreground">
            Read-only trace search · results capped at {RESULT_CAP}. Company email is not available on{" "}
            <span className="font-mono">companies</span>. Separate LR field is not stored — use tracking / eWay / courier.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="so" className="text-xs">
            SO / Order no.
          </TabsTrigger>
          <TabsTrigger value="client" className="text-xs">
            Client
          </TabsTrigger>
          <TabsTrigger value="status" className="text-xs">
            Status
          </TabsTrigger>
          <TabsTrigger value="department" className="text-xs">
            Department
          </TabsTrigger>
          <TabsTrigger value="product" className="text-xs">
            Product / SKU
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="text-xs">
            Dispatch
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="text-xs">
            Exceptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="so" className="space-y-2">
          <Input
            placeholder="SO number (e.g. SO-2026-000142) or UUID fragment (min 2 chars)"
            value={soQuery}
            onChange={(e) => setSoQuery(e.target.value)}
            className="font-mono text-sm"
          />
        </TabsContent>

        <TabsContent value="client" className="space-y-2">
          <Input
            placeholder="Business name, phone, or GST"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Matched via linked company profile.</p>
        </TabsContent>

        <TabsContent value="status" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Raw order status</label>
            <Select value={rawStatus} onValueChange={setRawStatus}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>Any</SelectItem>
                {ORDER_LOCATOR_RAW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Derived trace bucket</label>
            <Select value={derivedBucket} onValueChange={setDerivedBucket}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Optional filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>None</SelectItem>
                {derivedBucketOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="gap-1" onClick={() => void runSearch("status")} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </Button>
        </TabsContent>

        <TabsContent value="department" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Production / product department</label>
            <Select value={deptChoice} onValueChange={setDeptChoice}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Choose department" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ANY_VALUE}>Choose…</SelectItem>
                {deptOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="gap-1" onClick={() => void runSearch("department")} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </Button>
        </TabsContent>

        <TabsContent value="product" className="space-y-2">
          <Input
            placeholder="Product name, SKU, or category (min 2 chars)"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            className="text-sm"
          />
        </TabsContent>

        <TabsContent value="dispatch" className="flex flex-col gap-2">
          <Input
            placeholder="Tracking no., eWay bill, or courier name"
            value={dispatchText}
            onChange={(e) => setDispatchText(e.target.value)}
            className="text-sm"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Dispatch bucket (optional)</label>
              <Select value={dispatchBucket} onValueChange={setDispatchBucket}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_VALUE}>None</SelectItem>
                  {derivedBucketOptions
                    .filter((o) => o.value.startsWith("dispatch_"))
                    .map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="gap-1" onClick={() => void runSearch("dispatch")} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={exceptionDelayed ? "default" : "outline"}
              className="text-xs"
              onClick={() => setExceptionDelayed((v) => !v)}
            >
              Delayed (promised date passed)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={exceptionBalance ? "default" : "outline"}
              className="text-xs"
              onClick={() => setExceptionBalance((v) => !v)}
            >
              Balance pending
            </Button>
            <Button
              type="button"
              size="sm"
              variant={exceptionAdvance ? "default" : "outline"}
              className="text-xs"
              onClick={() => setExceptionAdvance((v) => !v)}
            >
              Awaiting advance
            </Button>
            <Button
              type="button"
              size="sm"
              variant={exceptionPartial ? "default" : "outline"}
              className="text-xs"
              onClick={() => setExceptionPartial((v) => !v)}
            >
              Partial ready
            </Button>
            <Button
              type="button"
              size="sm"
              variant={exceptionReq ? "default" : "outline"}
              className="text-xs"
              onClick={() => setExceptionReq((v) => !v)}
            >
              Requisition pending
            </Button>
          </div>
          <Button size="sm" className="gap-1" onClick={() => void runSearch("exceptions")} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Run exception search
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Non-delayed flags scan the latest {SCAN_CAP} orders (read-only) then filter using trace rules.
          </p>
        </TabsContent>
      </Tabs>

      {lastError && <p className="text-xs text-destructive">{lastError}</p>}

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>{results.length} match(es)</span>
        </div>

        {results.length > 0 && (
          <div className="max-h-[340px] space-y-2 overflow-y-auto rounded-lg border border-border">
            {results.map((row) => (
              <div
                key={row.base.id}
                className="flex flex-col gap-2 border-b border-border p-3 text-xs last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium text-foreground">
                      {formatSalesOrderLabel(row.base)}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {row.base.status}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {row.preview.dispatch}
                    </Badge>
                  </div>
                  <p className="truncate text-muted-foreground">
                    {(row.base.company?.business_name ?? "—") +
                      (row.base.company?.phone ? ` · ${row.base.company.phone}` : "")}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Responsible · </span>
                    {row.preview.responsible}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Finance:</span>
                    {financeBadge(row.preview)}
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Line pending {row.preview.pendingLineCount} · units {row.preview.pendingUnitTotal}
                    {row.preview.requisitionPendingUnits > 0
                      ? ` · req pending ${row.preview.requisitionPendingUnits} u (${row.preview.requisitionPendingLines} lines)`
                      : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1 self-start sm:self-center" onClick={() => onOpenTrace(row.base.id)}>
                  <Route className="h-3.5 w-3.5" />
                  Open trace
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
