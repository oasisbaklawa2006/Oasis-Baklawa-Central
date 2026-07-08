import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  computeCatalogueReadiness,
  type ReadinessResult,
  type ReadinessState,
} from "@/lib/catalogueReadinessScore";

interface CatalogueBuilderProduct {
  id: string;
  name: string | null;
  sku: string | null;
  category: string | null;
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
          "id, name, sku, category, production_department, uom, settlement_unit, carton_type, packs_per_master_carton, image_url, is_active, visible_in_catalog, shelf_life, storage_type, description",
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
