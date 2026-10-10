import { Link } from "react-router-dom";
import { Package, ScanBarcode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComplianceException } from "@/lib/management-reporting";
import type { ManagementCommandCenterProjection } from "@/lib/management-reporting/managementReportingTypes";
import type { ManagementCommandCenterFilters } from "@/hooks/useManagementCommandCenter";
import type { ManagementCommandCenterUiHandlers } from "@/pages/admin/useManagementCommandCenterUiHandlers";

/** Shared cap for compliance exception queue rendering and the shown-count badge. */
export const COMPLIANCE_EXCEPTION_DISPLAY_LIMIT = 40;

type CompliancePanelProps = {
  projection: ManagementCommandCenterProjection | null;
  filters: ManagementCommandCenterFilters;
  loading: boolean;
  eanTotal: number;
  eanSearchInput: string;
  exceptionCategory: ComplianceException["category"] | "all";
  exceptionSeverity: ComplianceException["severity"] | "all";
  filteredExceptions: ComplianceException[];
  uiHandlers: ManagementCommandCenterUiHandlers;
};

/** EAN registry and compliance exception queue (extracted for Codacy/ESLint line hygiene). */
export function ManagementCompliancePanel({
  projection,
  filters,
  loading,
  eanTotal,
  eanSearchInput,
  exceptionCategory,
  exceptionSeverity,
  filteredExceptions,
  uiHandlers,
}: CompliancePanelProps) {
  const p = projection;

  return (
    <TabsContent value="compliance" className="space-y-4">
      {p?.complianceDataUnavailable ? (
        <p className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-900">
          EAN registry and compliance exceptions unavailable — products read failed.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search EAN, SKU, product name…"
          value={eanSearchInput}
          onChange={uiHandlers.handleEanSearchChange}
          className="max-w-sm"
        />
        <Select value={exceptionCategory} onValueChange={uiHandlers.handleExceptionCategoryChange}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="ean">EAN</SelectItem>
            <SelectItem value="fssai">FSSAI</SelectItem>
            <SelectItem value="label">Label</SelectItem>
            <SelectItem value="hsn_gst">HSN/GST</SelectItem>
            <SelectItem value="nutrition">Nutrition</SelectItem>
          </SelectContent>
        </Select>
        <Select value={exceptionSeverity} onValueChange={uiHandlers.handleExceptionSeverityChange}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-[10px]">
          {p?.complianceDataUnavailable
            ? "exceptions unavailable"
            : `${Math.min(filteredExceptions.length, COMPLIANCE_EXCEPTION_DISPLAY_LIMIT)} shown / ${p?.complianceExceptions.length ?? 0} total`}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {p?.complianceDataUnavailable ? "registry unavailable" : `${eanTotal} registry rows`}
        </Badge>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={filters.eanPage <= 0 || loading}
            onClick={uiHandlers.handleEanPagePrevious}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              loading ||
              (projection?.eanRegistry.length ?? 0) < filters.eanPageSize ||
              (filters.eanPage + 1) * filters.eanPageSize >= eanTotal
            }
            onClick={uiHandlers.handleEanPageNext}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScanBarcode className="h-4 w-4" aria-hidden />
              EAN registry
            </CardTitle>
            <CardDescription className="text-xs">
              Canonical source: products.barcode_sku — duplicate prevention visibility only
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>EAN</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(p?.eanRegistry ?? []).map((e) => (
                  <TableRow key={e.productId}>
                    <TableCell className="max-w-[140px] truncate text-xs">
                      <Link to={e.drillRoute} className="hover:underline">
                        {e.productName}
                      </Link>
                      {e.isDuplicate ? (
                        <Badge variant="destructive" className="ml-1 text-[9px]">
                          DUP
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">{e.ean ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{e.complianceScore}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4" aria-hidden />
              Management exception queue
            </CardTitle>
            <CardDescription className="text-xs">
              FSSAI / legal label / HSN-GST / EAN readiness — no invented approvals
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto text-xs">
            {filteredExceptions.length === 0 ? (
              <p className="text-muted-foreground">No exceptions match the current filters</p>
            ) : (
              filteredExceptions.slice(0, COMPLIANCE_EXCEPTION_DISPLAY_LIMIT).map((ex) => (
                <Link
                  key={ex.id}
                  to={ex.drillRoute}
                  className="flex items-start justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{ex.entityLabel}</p>
                    <p className="text-muted-foreground">{ex.message}</p>
                  </div>
                  <Badge
                    variant={
                      ex.severity === "critical"
                        ? "destructive"
                        : ex.severity === "high"
                          ? "default"
                          : "secondary"
                    }
                    className="shrink-0 text-[9px] uppercase"
                  >
                    {ex.category}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
