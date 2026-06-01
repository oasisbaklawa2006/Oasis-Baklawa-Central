import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CatalogueSyncStatus } from "@/lib/catalogue-connector";

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

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Catalogue sync status
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only view of approved AI Catalogue Builder → Central product mappings. Products are
            never deleted — inactive publishes hide and deactivate SKUs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

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
              No catalogue mappings yet. Run sync from the AI Catalogue Builder integration when
              approved products are published.
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
