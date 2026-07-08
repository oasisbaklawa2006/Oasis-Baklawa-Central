import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Wand2,
  Search,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  RotateCcw,
  Copy,
  FileText,
  Save,
  History,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  computeCatalogueReadiness,
  type ReadinessResult,
  type ReadinessState,
} from "@/lib/catalogueReadinessScore";
import {
  DRAFT_BLOCK_META,
  generateCatalogueDrafts,
  type DraftBlocks,
} from "@/lib/catalogueContentDrafts";
import type {
  CatalogueDraftAuditRow,
  CatalogueDraftContentKey,
  CatalogueDraftRow,
  CatalogueDraftStatus,
} from "@/lib/catalogueDraftTypes";
import {
  approveDraft,
  fetchDraftAuditLog,
  fetchLatestDraft,
  rejectDraft,
  saveDraft,
  submitDraftForReview,
} from "@/lib/catalogueDraftRepository";
import { STATUS_LABEL, canApprove, canReject, canSubmitForReview } from "@/lib/catalogueDraftWorkflow";

/** DraftBlocks (editor state) <-> catalogue_ai_studio_drafts row — only the column name differs. */
function mapContentToRow(drafts: DraftBlocks): Record<CatalogueDraftContentKey, string> {
  return {
    catalogue_title: drafts.catalogue_title,
    short_description: drafts.short_description,
    long_description: drafts.long_description,
    b2b_sales_copy: drafts.b2b_sales_copy,
    export_catalogue_copy: drafts.export_catalogue_copy,
    whatsapp_product_message: drafts.whatsapp_message,
    hindi_description: drafts.hindi_description,
    storage_shelf_life_copy: drafts.storage_shelf_life_copy,
  };
}

function mapRowToContent(row: CatalogueDraftRow): DraftBlocks {
  return {
    catalogue_title: row.catalogue_title,
    short_description: row.short_description,
    long_description: row.long_description,
    b2b_sales_copy: row.b2b_sales_copy,
    export_catalogue_copy: row.export_catalogue_copy,
    whatsapp_message: row.whatsapp_product_message,
    hindi_description: row.hindi_description,
    storage_shelf_life_copy: row.storage_shelf_life_copy,
  };
}

const DRAFT_STATUS_BADGE_CLASS: Record<CatalogueDraftStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40",
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/40",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/40",
};

interface CatalogueBuilderProduct {
  id: string;
  name: string | null;
  sku: string | null;
  category: string | null;
  sub_category: string | null;
  production_department: string | null;
  uom: string | null;
  settlement_unit: string | null;
  carton_type: string | null;
  packs_per_master_carton: number | null;
  image_url: string | null;
  is_active: boolean | null;
  visible_in_catalog: boolean | null;
  shelf_life: string | null;
  storage_type: string | null;
  description: string | null;
  mrp: number | null;
  wholesale_price: number | null;
  pack_size: string | null;
  net_weight_grams: number | null;
  weight_per_pc_grams: number | null;
  moq: number | null;
  dietary_tags: string[] | null;
  allergen_warnings: string | null;
  ingredients: string | null;
  hsn_code: string | null;
  gst_percentage: number | null;
}

const STATE_TEXT_COLOR: Record<ReadinessState, string> = {
  pass: "text-emerald-600",
  warn: "text-amber-600",
  missing: "text-destructive",
};

const STATE_BADGE_CLASS: Record<ReadinessState, string> = {
  pass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/40",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40",
  missing: "bg-destructive/10 text-destructive border-destructive/40",
};

const STATE_ICON: Record<ReadinessState, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertCircle,
  missing: XCircle,
};

const STATE_LABEL: Record<ReadinessState, string> = {
  pass: "Ready",
  warn: "Needs attention",
  missing: "Missing",
};

const OVERALL_BADGE_CLASS: Record<ReadinessResult["overallLabel"], string> = {
  "Catalogue-ready": STATE_BADGE_CLASS.pass,
  "Needs attention": STATE_BADGE_CLASS.warn,
  "Not ready": STATE_BADGE_CLASS.missing,
};

export default function AdminCatalogueBuilder() {
  const { user } = useAuth();
  const [products, setProducts] = useState<CatalogueBuilderProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      setLoading(true);
      setError(null);
      // Same safe read-only pattern already used by AdminProducts: select from `products`, no writes.
      const { data, error: queryError } = await supabase
        .from("products")
        .select(
          "id, name, sku, category, sub_category, production_department, uom, settlement_unit, carton_type, packs_per_master_carton, image_url, is_active, visible_in_catalog, shelf_life, storage_type, description, mrp, wholesale_price, pack_size, net_weight_grams, weight_per_pc_grams, moq, dietary_tags, allergen_warnings, ingredients, hsn_code, gst_percentage",
        )
        .order("name", { ascending: true });
      if (cancelled) return;
      if (queryError) {
        setProducts([]);
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setProducts(((data as CatalogueBuilderProduct[]) || []));
      setLoading(false);
    }
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) || null, [products, selectedId]);
  const readiness: ReadinessResult | null = useMemo(
    () => (selected ? computeCatalogueReadiness(selected) : null),
    [selected],
  );

  // Draft text lives only in local component state — it is never sent to Supabase or read back into
  // the product record. Keyed by productId so a product switch can never render or copy the previous
  // product's drafts: `drafts` below is computed synchronously during render (not via a delayed effect),
  // so it is always correct for `selected` even in the same render pass where selectedId just changed.
  const [draftState, setDraftState] = useState<{ productId: string; drafts: DraftBlocks } | null>(null);

  const drafts: DraftBlocks | null = useMemo(() => {
    if (!selected) return null;
    if (draftState && draftState.productId === selected.id) return draftState.drafts;
    return generateCatalogueDrafts(selected);
  }, [selected, draftState]);

  const resetDraftsFromProduct = () => {
    if (!selected) return;
    setDraftState({ productId: selected.id, drafts: generateCatalogueDrafts(selected) });
    toast.success("Draft reset from current product data.");
  };

  const updateDraftBlock = (key: keyof DraftBlocks, value: string) => {
    if (!selected) return;
    setDraftState((prev) => {
      const base = prev && prev.productId === selected.id ? prev.drafts : generateCatalogueDrafts(selected);
      return { productId: selected.id, drafts: { ...base, [key]: value } };
    });
  };

  const copyDraftBlock = async (key: keyof DraftBlocks, label: string) => {
    const text = drafts?.[key] ?? "";
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access.");
    }
  };

  // Persisted draft governance (PR #225).
  const [persistedDraft, setPersistedDraft] = useState<CatalogueDraftRow | null>(null);
  const [auditLog, setAuditLog] = useState<CatalogueDraftAuditRow[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Always holds the product id that is actually on screen right now, read synchronously by every
  // in-flight async handler/effect callback below — never the stale product id closed over when that
  // async call started. This is what lets us discard a response that arrives after the operator has
  // already moved on to a different product, instead of applying it to the wrong one.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);

  // One product-switch effect owns the entire transition: it clears the previous product's persisted
  // draft/audit/reject state and seeds a fresh generated draft immediately, then fetches and hydrates
  // the real saved draft (if any). No separate effect is left that could apply stale state out of order.
  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setPersistedDraft(null);
      setAuditLog([]);
      setRejectReasonOpen(false);
      setRejectReason("");
      setDraftState(null);
      setDraftLoading(false);
      return;
    }
    const productId = selected.id;
    setPersistedDraft(null);
    setAuditLog([]);
    setRejectReasonOpen(false);
    setRejectReason("");
    setDraftState({ productId, drafts: generateCatalogueDrafts(selected) });
    setDraftLoading(true);

    fetchLatestDraft(productId)
      .then(async (row) => {
        if (cancelled || selectedIdRef.current !== productId) return;
        setPersistedDraft(row);
        if (row) {
          setDraftState({ productId, drafts: mapRowToContent(row) });
          const log = await fetchDraftAuditLog(row.id);
          if (!cancelled && selectedIdRef.current === productId) setAuditLog(log);
        }
      })
      .catch((err) => {
        if (!cancelled && selectedIdRef.current === productId) {
          toast.error(err instanceof Error ? err.message : "Could not load saved draft.");
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const refreshAuditLog = async (draftId: string) => {
    try {
      setAuditLog(await fetchDraftAuditLog(draftId));
    } catch {
      // History is a convenience view — a refresh failure here should not block the workflow action.
    }
  };

  // The single source of truth every badge/button/handler below reads: persistedDraft is only ever
  // treated as "the current draft" when it, the hydrated editor state, AND the selected product all
  // agree on the same product id. Any mismatch (a stale fetch mid-switch, a race on the ref) collapses
  // this to null, which disables every workflow action rather than risk acting on the wrong draft.
  const currentPersistedDraft: CatalogueDraftRow | null =
    persistedDraft && selected && draftState &&
    persistedDraft.product_id === selected.id &&
    draftState.productId === selected.id
      ? persistedDraft
      : null;

  // Locked only while UNDER_REVIEW: a reviewer must approve/reject before content can change again.
  // DRAFT/APPROVED/REJECTED all stay editable — saving from APPROVED/REJECTED starts the next version.
  const textLocked = currentPersistedDraft?.status === "UNDER_REVIEW";
  // While the persisted draft is still being fetched/hydrated, no workflow action or edit may occur —
  // it would otherwise be able to act on / overwrite a draft the operator has not actually seen yet.
  const workflowDisabled = draftBusy || draftLoading;

  const handleSaveDraft = async () => {
    if (!selected || !drafts) return;
    const productId = selected.id;
    setDraftBusy(true);
    try {
      const row = await saveDraft({
        productId,
        content: mapContentToRow(drafts),
        actorId: user?.id ?? null,
      });
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setDraftState({ productId, drafts: mapRowToContent(row) });
      await refreshAuditLog(row.id);
      toast.success(`Draft saved — v${row.version_number} (${STATUS_LABEL[row.status as CatalogueDraftStatus]}).`);
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  const handleLoadLatestDraft = async () => {
    if (!selected) return;
    const productId = selected.id;
    setDraftBusy(true);
    try {
      const row = await fetchLatestDraft(productId);
      if (selectedIdRef.current !== productId) return;
      if (!row) {
        toast.error("No saved draft yet for this product.");
        return;
      }
      setPersistedDraft(row);
      setDraftState({ productId, drafts: mapRowToContent(row) });
      await refreshAuditLog(row.id);
      toast.success(`Loaded v${row.version_number} (${STATUS_LABEL[row.status as CatalogueDraftStatus]}).`);
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not load draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  // Always persists exactly what is currently visible in the editor into the DRAFT row first, then
  // transitions that same saved row to UNDER_REVIEW — never submits stale database content, and never
  // acts against a product the operator has since navigated away from.
  const handleSubmitForReview = async () => {
    if (!selected || !drafts) return;
    if (!currentPersistedDraft || draftLoading) {
      toast.error("Draft is still loading. Please wait.");
      return;
    }
    const productId = selected.id;
    setDraftBusy(true);
    try {
      const saved = await saveDraft({
        productId,
        content: mapContentToRow(drafts),
        actorId: user?.id ?? null,
      });
      if (selectedIdRef.current !== productId) return;
      const row = await submitDraftForReview(saved.id, user?.id ?? null);
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setDraftState({ productId, drafts: mapRowToContent(row) });
      await refreshAuditLog(row.id);
      toast.success("Submitted for review.");
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not submit for review.");
    } finally {
      setDraftBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (!currentPersistedDraft || draftLoading) {
      toast.error("Draft is still loading. Please wait.");
      return;
    }
    const productId = selected.id;
    const draftId = currentPersistedDraft.id;
    setDraftBusy(true);
    try {
      const row = await approveDraft(draftId, user?.id ?? null);
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setDraftState({ productId, drafts: mapRowToContent(row) });
      await refreshAuditLog(row.id);
      toast.success("Draft approved.");
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not approve draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    if (!currentPersistedDraft || draftLoading) {
      toast.error("Draft is still loading. Please wait.");
      return;
    }
    const productId = selected.id;
    const draftId = currentPersistedDraft.id;
    setDraftBusy(true);
    try {
      const row = await rejectDraft(draftId, user?.id ?? null, rejectReason.trim());
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setDraftState({ productId, drafts: mapRowToContent(row) });
      await refreshAuditLog(row.id);
      setRejectReasonOpen(false);
      setRejectReason("");
      toast.success("Draft rejected.");
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not reject draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Wand2 size={20} className="text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-display tracking-tight text-foreground">Catalogue Builder</h1>
          <p className="text-[11px] text-muted-foreground">
            Select a product to see its catalogue summary and readiness score.
          </p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px] uppercase">
          Workspace preview — readiness scoring only, no AI or media generation yet
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search size={14} /> Select a product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name, SKU, or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle size={14} /> {error}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No products match.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-1">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                      selectedId === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-semibold text-foreground truncate">{p.name || "Untitled product"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {p.sku || "No SKU"} · {p.category || "No category"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Select a product from the list to see its catalogue summary and readiness score.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-sm">{selected.name || "Untitled product"}</CardTitle>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/products?productId=${selected.id}`}>
                        <ExternalLink size={12} className="mr-1.5" /> Edit in Product Catalogue
                      </Link>
                    </Button>
                  </div>
                  <CardDescription className="text-[11px]">
                    This summary is read-only. Use the button above to make any changes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">SKU</p>
                      <p className="font-medium text-foreground">{selected.sku || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Category</p>
                      <p className="font-medium text-foreground">{selected.category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">UOM</p>
                      <p className="font-medium text-foreground">{selected.uom || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Carton Type</p>
                      <p className="font-medium text-foreground">{selected.carton_type || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Hero Image</p>
                      <p className="font-medium text-foreground flex items-center gap-1">
                        <ImageIcon
                          size={12}
                          className={selected.image_url ? "text-emerald-600" : "text-muted-foreground/40"}
                        />
                        {selected.image_url ? "Present" : "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Active</p>
                      <p className="font-medium text-foreground">{(selected.is_active ?? true) ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Catalogue Visibility</p>
                      <p className="font-medium text-foreground">
                        {(selected.visible_in_catalog ?? true) ? "Visible to buyers" : "Hidden — internal only"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {readiness && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-sm">Catalogue readiness</CardTitle>
                      <Badge className={OVERALL_BADGE_CLASS[readiness.overallLabel]}>
                        {readiness.overallLabel} · {readiness.score}%
                      </Badge>
                    </div>
                    <CardDescription className="text-[11px]">
                      Calculated only from the fields shown on this page — no AI review, no approval decision.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {readiness.categories.map((c) => {
                      const Icon = STATE_ICON[c.state];
                      return (
                        <div key={c.key} className="flex items-start gap-3 rounded-lg border border-border p-3">
                          <Icon size={16} className={`${STATE_TEXT_COLOR[c.state]} mt-0.5 shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{c.label}</span>
                              <Badge variant="outline" className={`text-[9px] uppercase ${STATE_BADGE_CLASS[c.state]}`}>
                                {STATE_LABEL[c.state]}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{c.detail}</p>
                            {c.nextAction && (
                              <p className="text-[11px] text-foreground mt-1">
                                <span className="font-semibold">Next: </span>
                                {c.nextAction}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {drafts && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText size={14} /> Content Draft Studio
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {currentPersistedDraft && (
                          <Badge variant="outline" className={`text-[9px] uppercase ${DRAFT_STATUS_BADGE_CLASS[currentPersistedDraft.status as CatalogueDraftStatus]}`}>
                            {STATUS_LABEL[currentPersistedDraft.status as CatalogueDraftStatus]} · v{currentPersistedDraft.version_number}
                          </Badge>
                        )}
                        <Button type="button" size="sm" variant="outline" disabled={draftLoading} onClick={resetDraftsFromProduct}>
                          <RotateCcw size={12} className="mr-1.5" /> Reset draft from product data
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="text-[11px]">
                      Generated locally from this product's current fields — no external AI call in this preview.
                    </CardDescription>
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      <AlertTriangle size={14} className="shrink-0" />
                      Draft only — does not update live product data.
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" disabled={workflowDisabled || textLocked} onClick={handleSaveDraft}>
                        <Save size={12} className="mr-1.5" /> Save Draft
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={handleLoadLatestDraft}>
                        <History size={12} className="mr-1.5" /> Load Latest Draft
                      </Button>
                      {currentPersistedDraft && canSubmitForReview(currentPersistedDraft.status as CatalogueDraftStatus) && (
                        <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={handleSubmitForReview}>
                          Submit for Review
                        </Button>
                      )}
                      {currentPersistedDraft && canApprove(currentPersistedDraft.status as CatalogueDraftStatus) && (
                        <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={handleApprove}>
                          <ShieldCheck size={12} className="mr-1.5" /> Approve
                        </Button>
                      )}
                      {currentPersistedDraft && canReject(currentPersistedDraft.status as CatalogueDraftStatus) && !rejectReasonOpen && (
                        <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={() => setRejectReasonOpen(true)}>
                          <Ban size={12} className="mr-1.5" /> Reject
                        </Button>
                      )}
                      {draftLoading && (
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Loader2 size={12} className="animate-spin" /> Loading saved draft…
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Workflow actions use the currently displayed saved draft.
                    </p>

                    {rejectReasonOpen && (
                      <div className="mt-2 space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                        <label className="text-[11px] font-semibold text-foreground">Rejection reason</label>
                        <Textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                          className="text-xs"
                          placeholder="Explain what needs to change before resubmission…"
                        />
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="destructive" disabled={workflowDisabled || !rejectReason.trim()} onClick={handleReject}>
                            Confirm Reject
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled={workflowDisabled} onClick={() => { setRejectReasonOpen(false); setRejectReason(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {textLocked && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Under review — approve or reject before editing again.
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {DRAFT_BLOCK_META.map((block) => (
                      <div key={block.key} className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <label className="text-xs font-semibold text-foreground">{block.label}</label>
                            <p className="text-[10px] text-muted-foreground">{block.hint}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={draftLoading}
                            onClick={() => copyDraftBlock(block.key, block.label)}
                          >
                            <Copy size={12} className="mr-1.5" /> Copy
                          </Button>
                        </div>
                        <Textarea
                          value={drafts[block.key]}
                          onChange={(e) => updateDraftBlock(block.key, e.target.value)}
                          rows={block.key === "long_description" ? 4 : 2}
                          className="text-xs"
                          disabled={textLocked || draftLoading}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {currentPersistedDraft && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <History size={14} /> History / audit
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Draft workflow actions for v{currentPersistedDraft.version_number}, most recent first.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {auditLog.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No actions recorded yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {auditLog.map((entry) => (
                          <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[11px]">
                            <span className="font-semibold text-foreground">{entry.action}</span>
                            <span className="text-muted-foreground">
                              {entry.from_status ?? "—"} → {entry.to_status ?? "—"}
                            </span>
                            <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
