import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  createProductIntelligenceService,
  type ProductIntelligenceResolution,
} from "@/lib/product-intelligence";

const SAMPLE_UTTERANCES = [
  "Need 2 kg Kitta",
  "Send Mor Cashew Asiyah",
  "Need Pistachio Pyramid",
  "Mix Nut Tart 500gm",
  "Coconut Durum 1 kg",
  "Need Asiyah",
  "Need Baklava",
];

/**
 * Read-only prototype — consumes approved aliases from `product_aliases` + `products.aliases`.
 * No orders, WhatsApp sends, or catalogue sync writes.
 */
export default function ProductIntelligencePrototype() {
  const service = useMemo(() => createProductIntelligenceService(supabase), []);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [utterance, setUtterance] = useState(SAMPLE_UTTERANCES[0]!);
  const [result, setResult] = useState<ProductIntelligenceResolution | null>(null);
  const catalog = service.getCatalog();

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await service.loadCatalog();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Catalogue load failed");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runResolve = useCallback(() => {
    setResult(service.resolve(utterance));
  }, [service, utterance]);

  useEffect(() => {
    runResolve();
  }, [catalog, utterance, runResolve]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Brain className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Product intelligence prototype</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Read-only
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Reload aliases
        </Button>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Consumption prototype only
          </CardTitle>
          <CardDescription className="text-xs">
            SELECT on <code className="text-[10px]">product_aliases</code> and{" "}
            <code className="text-[10px]">products</code> only. No orders, WhatsApp, sync, or production writes.
          </CardDescription>
        </CardHeader>
        {catalog ? (
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>
              Loaded {catalog.alias_count} approved aliases across {catalog.product_count} active products ·{" "}
              {catalog.loaded_at}
            </p>
            {!catalog.catalog_complete ? (
              <p className="text-destructive">
                Catalogue load incomplete — PostgREST page cap may have truncated results. Reload or contact admin.
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Customer utterance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={utterance}
            onChange={(e) => setUtterance(e.target.value)}
            className="min-h-[80px] text-sm"
            aria-label="Free-form customer text"
          />
          <div className="flex flex-wrap gap-2">
            {SAMPLE_UTTERANCES.map((sample) => (
              <Button
                key={sample}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setUtterance(sample)}
              >
                {sample}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resolution</CardTitle>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={result.clarification_required ? "destructive" : "default"}>
                {result.clarification_required ? "Clarification required" : "Specific match"}
              </Badge>
              {result.best_match ? (
                <Badge variant="outline">{result.best_match.confidence}% confidence</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">{result.explanation}</p>
            {result.candidate_products.length > 0 ? (
              <ul className="space-y-2">
                {result.candidate_products.map((c) => (
                  <li key={c.productId} className="rounded-md border border-border/60 p-2 text-xs">
                    <p className="font-medium">
                      {c.productName}{" "}
                      <span className="text-muted-foreground">({c.confidence}%)</span>
                    </p>
                    {c.sku ? <p className="text-muted-foreground">SKU {c.sku}</p> : null}
                    {c.matched_aliases.length > 0 ? (
                      <p>Aliases: {c.matched_aliases.join(", ")}</p>
                    ) : null}
                    <ul className="mt-1 list-inside list-disc text-muted-foreground">
                      {c.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No candidates.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
