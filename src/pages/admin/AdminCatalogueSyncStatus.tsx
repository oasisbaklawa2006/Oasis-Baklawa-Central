import { useCallback, useEffect, useMemo, useState } from "react";
import { FileJson, Link2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createCatalogueConnectorBundle,
  intakeApprovedCatalogueSnapshot,
  type CatalogueSyncResult,
  type CatalogueSyncStatus,
} from "@/lib/catalogue-connector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const PILOT_JSON_EXAMPLE = `{
  "external_catalogue_product_id": "builder-prod-001",
  "sku": "OAS-PUR-1",
  "product_name": "Premium Pack",
  "product_description": "Approved catalogue copy",
  "approved_image_urls": ["https://cdn.example.com/product.jpg"],
  "mrp": 500,
  "base_price": 400,
  "pack_size": "500g",
  "category": "Ready Packs",
  "hsn_code": "19059090",
  "gst_rate": 5,
  "uom": "Pc",
  "status": "active",
  "version": 1,
  "updated_at": "2026-06-01T12:00:00Z"
}`;

interface MappingRow {
  id: string;
  sku: string;
  external_catalogue_product_id: string;
  central_product_id: string | null;
  source_version: number;
  sync_status: CatalogueSyncStatus;
  last_synced_at: string | null;
  product_name: string | null;
}

export default function AdminCatalogueSyncStatus() {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<CatalogueSyncResult | null>(null);
  const [lastValidationErrors, setLastValidationErrors] = useState<string[]>([]);

  const connector = useMemo(() => createCatalogueConnectorBundle(supabase), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("catalogue_product_mappings")
        .select(
          "id, sku, external_catalogue_product_id, central_product_id, source_version, sync_status, last_synced_at",
        )
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;

      const mappings = data ?? [];
      const productIds = [
        ...new Set(mappings.map((m) => m.central_product_id).filter(Boolean)),
      ] as string[];

      let nameById: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        nameById = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]));
      }

      setRows(
        mappings.map((m) => ({
          id: m.id,
          sku: m.sku,
          external_catalogue_product_id: m.external_catalogue_product_id,
          central_product_id: m.central_product_id,
          source_version: m.source_version,
          sync_status: m.sync_status as CatalogueSyncStatus,
          last_synced_at: m.last_synced_at,
          product_name: m.central_product_id ? nameById[m.central_product_id] ?? null : null,
        })),
      );
    } catch (e) {
      console.error("[AdminCatalogueSyncStatus]", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runImport = async () => {
    setImporting(true);
    setLastImport(null);
    setLastValidationErrors([]);
    try {
      const raw = jsonInput.trim();
      if (!raw) {
        setLastValidationErrors(["Paste approved snapshot JSON first"]);
        toast.error("JSON is empty");
        return;
      }

      const result = await intakeApprovedCatalogueSnapshot(connector.store, raw);
      if (result.ok === false) {
        const messages = result.validation.errors.map((e) => `${e.field}: ${e.message}`);
        setLastValidationErrors(messages);
        toast.error("Validation failed");
        return;
      }

      setLastImport(result.sync);
      if (result.sync.sync_status === "synced") {
        toast.success(`Synced ${result.sync.sku}`);
      } else if (result.sync.sync_status === "skipped_stale") {
        toast.message(`Skipped stale version for ${result.sync.sku}`);
      } else if (result.sync.sync_status === "deactivated") {
        toast.success(`Deactivated ${result.sync.sku}`);
      } else {
        toast.error(result.sync.error ?? `Sync status: ${result.sync.sync_status}`);
      }
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setLastValidationErrors([message]);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Catalogue sync status
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pilot intake: paste an approved AI Catalogue Builder snapshot (JSON). Central maps to{" "}
            <code className="text-xs">products</code> — never deletes rows. Webhook/pull comes in a
            later phase.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Pilot import (manual JSON)
          </CardTitle>
          <CardDescription>
            One <code className="text-xs">ApprovedCatalogueProductSnapshot</code> per import. Required:
            external_catalogue_product_id, sku, product_name, category, hsn_code, status, version,
            updated_at, approved_image_urls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="catalogue-json">Approved snapshot JSON</Label>
            <Textarea
              id="catalogue-json"
              className="font-mono text-xs min-h-[200px]"
              placeholder={PILOT_JSON_EXAMPLE}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runImport()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Import &amp; sync
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setJsonInput(PILOT_JSON_EXAMPLE)}>
              Load example
            </Button>
          </div>
          {lastValidationErrors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <p className="font-medium mb-1">Rejected</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {lastValidationErrors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          {lastImport && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">Last import result</p>
              <p>
                SKU <span className="font-mono">{lastImport.sku}</span> · status{" "}
                <Badge variant="secondary">{lastImport.sync_status}</Badge>
              </p>
              {lastImport.product?.central_product_id && (
                <p className="text-muted-foreground font-mono text-xs">
                  central_product_id: {lastImport.product.central_product_id}
                </p>
              )}
              {lastImport.error && <p className="text-destructive">{lastImport.error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mappings</CardTitle>
          <CardDescription>SKU · Central product · builder version · last sync</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No catalogue mappings yet. Use pilot import above or connect the Builder app (Phase
              25D+).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Central product</TableHead>
                  <TableHead>Source version</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell>
                      {row.central_product_id ? (
                        <span className="text-sm">
                          {row.product_name ?? "—"}{" "}
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {row.central_product_id.slice(0, 8)}…
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not mapped</span>
                      )}
                    </TableCell>
                    <TableCell>{row.source_version}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_synced_at
                        ? new Date(row.last_synced_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.sync_status === "synced" ? "default" : "secondary"}>
                        {row.sync_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
