import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldAlert, Clock, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalReadOnlyBanner } from "@/components/admin/OperationalReadOnlyBanner";
import { ExecutionInternalOnlyBanner } from "@/components/execution/ExecutionInternalOnlyBanner";
import { useOperationalGlobalSearch } from "@/hooks/useOperationalGlobalSearch";
import type { SearchIndexEntityType, SearchIndexSensitivity } from "@/lib/operational-search/searchIndexTypes";
import { buildSearchBackfillDryRunPlan } from "@/lib/operational-search/searchBackfillPlan";

export default function OperationalGlobalSearch() {
  const { loading, error, result, search, entityTypes } = useOperationalGlobalSearch();
  const [text, setText] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [department, setDepartment] = useState("");
  const [sensitivity, setSensitivity] = useState<string>("all");
  const [barcodeSoMode, setBarcodeSoMode] = useState(false);

  const dryRun = buildSearchBackfillDryRunPlan();

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!text.trim()) return;
      void search({
        text,
        entityTypes:
          entityFilter === "all" ? undefined : ([entityFilter] as SearchIndexEntityType[]),
        department: department.trim() || null,
        sensitivity: sensitivity === "all" ? null : (sensitivity as SearchIndexSensitivity),
        barcodeOrSoMode: barcodeSoMode,
        limit: 50,
      });
    }, 350);
    return () => clearTimeout(handle);
  }, [text, entityFilter, department, sensitivity, barcodeSoMode, search]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Search className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Operational global search</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Internal only
          </Badge>
        </div>
      </header>

      <OperationalReadOnlyBanner
        warnings={[
          "Not publicly released — staff search index only. No mutations or notifications from this page.",
          ...dryRun.validationWarnings.slice(0, 1),
        ]}
      />
      <ExecutionInternalOnlyBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
          <CardDescription>
            SO numbers, order UUIDs, barcodes, cartons, queue items, events, customers, dispatch refs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="pl-9"
              placeholder="SO-2026-000123, barcode, order id, customer…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Operational search query"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Entity type</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {entityTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Input
                placeholder="e.g. dispatch"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sensitivity</Label>
              <Select value={sensitivity} onValueChange={setSensitivity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="confidential">Confidential</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant={barcodeSoMode ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setBarcodeSoMode((v) => !v)}
              >
                <Filter className="mr-1 h-3.5 w-3.5" aria-hidden />
                Barcode / SO mode
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Results</CardTitle>
            <CardDescription>
              {result.cards.length} shown · {result.totalMatched} matched · {result.suppressedCount}{" "}
              suppressed by visibility/sensitivity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
            {!loading && result.cards.length === 0 && (
              <p className="text-sm text-muted-foreground">No matches. Index may be empty until backfill.</p>
            )}
            {result.cards.map((card) => (
              <div
                key={`${card.entityType}-${card.entityId}-${card.source}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{card.searchTitle}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {card.entityType}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {card.sensitivity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {card.visibility}
                    </Badge>
                  </div>
                  {card.searchSubtitle && (
                    <p className="text-sm text-muted-foreground">{card.searchSubtitle}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Source: {card.source} ·{" "}
                    <Clock className="mr-0.5 inline h-3 w-3" aria-hidden />
                    {new Date(card.updatedAt).toLocaleString()}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to={card.navigationPath}>Open</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Backfill contract (dry-run)
          </CardTitle>
          <CardDescription>No scheduled jobs or production backfill in this phase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Projected entries (estimate): {dryRun.projectedEntryCount}</p>
          <ul className="list-inside list-disc text-muted-foreground">
            {dryRun.sources.map((s) => (
              <li key={s.source}>
                {s.entityType}: {s.estimatedRows} rows — {s.available ? "available" : "pending"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
